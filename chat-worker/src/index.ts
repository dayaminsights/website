import Anthropic from "@anthropic-ai/sdk";
import { AgentError, claudeStream, runTurn, type StreamFn } from "./agent";
import { ALLOWED_ORIGINS, MAX_BODY_CHARS, MAX_VISITOR_MESSAGES, type Ctx, type Env } from "./config";
import { encodeEvent, type ChatEvent, type ErrorCode } from "./events";
import { countVisitorTurns, signHistory, verifyHistory } from "./history";
import { buildUserTurn, parseChatRequest } from "./request";

export default {
  fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    return handle(request, env, claudeStream(client), (p) => ctx.waitUntil(p));
  },
};

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  forbidden: 403,
  reset: 409,
  too_long: 413,
  rate_limited: 429,
  limit_reached: 429,
  unavailable: 503,
  refused: 503,
};

/** POST /chat. Everything before the stream starts answers with a status and {error}; after, with an error event. */
export async function handle(
  request: Request,
  env: Env,
  stream: StreamFn,
  waitUntil: (p: Promise<unknown>) => void = () => {},
): Promise<Response> {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin);
  const cors: Record<string, string> = allowed ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : { Vary: "Origin" };
  const fail = (code: ErrorCode) => Response.json({ error: code }, { status: STATUS[code], headers: cors });

  if (new URL(request.url).pathname !== "/chat") return new Response("Not found", { status: 404 });
  if (request.method === "OPTIONS") {
    if (!allowed) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  if (request.method !== "POST") return fail("bad_request");
  if (!allowed) return fail("forbidden");

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (!(await env.RATE_LIMITER.limit({ key: ip })).success) return fail("rate_limited");

  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) return fail("too_long");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail("bad_request");
  }
  const req = parseChatRequest(body);
  if ("error" in req) return fail(req.error);
  if (!(await verifyHistory(req.history, req.sig, env.HISTORY_SECRET))) return fail("reset");
  if (countVisitorTurns(req.history) >= MAX_VISITOR_MESSAGES) return fail("limit_reached");

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  // If the visitor closes the tab, writes fail; the turn just ends.
  const emit = (e: ChatEvent) => {
    writer.write(encoder.encode(encodeEvent(e))).catch(() => {});
  };

  const work = (async () => {
    try {
      const append = await runTurn(stream, req.history, buildUserTurn(req), emit);
      const sig = await signHistory([...req.history, ...append], env.HISTORY_SECRET);
      emit({ event: "done", data: { append, sig } });
    } catch (err) {
      emit({ event: "error", data: { code: err instanceof AgentError ? err.code : "unavailable" } });
    } finally {
      await writer.close().catch(() => {});
    }
  })();
  waitUntil(work);

  return new Response(readable, {
    headers: { ...cors, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store" },
  });
}
