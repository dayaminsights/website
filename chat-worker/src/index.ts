import Anthropic from "@anthropic-ai/sdk";
import { AgentError, claudeCall, runTurn, type ModelCall } from "./agent";
import { ALLOWED_ORIGINS, MAX_BODY_CHARS, MAX_LEAD_CHARS, MAX_VISITOR_MESSAGES, type Ctx, type Env } from "./config";
import { encodeEvent, type ChatEvent, type ErrorCode, type Lead } from "./events";
import { countVisitorTurns, signHistory, verifyHistory } from "./history";
import { buildUserTurn, parseChatRequest } from "./request";
import { chatRow, formRow, writeRow } from "./sheet";
import { countLeadCalls } from "./transcript";

// One client per Worker instance, reused across requests: building it is CPU the free plan can't spare.
let client: Anthropic | undefined;
let clientKey = "";

export default {
  fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    if (!client || clientKey !== env.ANTHROPIC_API_KEY) {
      client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
      clientKey = env.ANTHROPIC_API_KEY;
    }
    return handle(request, env, claudeCall(client), (p) => ctx.waitUntil(p));
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

/**
 * POST /chat: one chat turn. Everything before the stream starts answers with a status and
 * {error}; after, with an error event. POST /lead: a contact-form copy for the lead sheet.
 */
export async function handle(
  request: Request,
  env: Env,
  call: ModelCall,
  waitUntil: (p: Promise<unknown>) => void = () => {},
): Promise<Response> {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin);
  const cors: Record<string, string> = allowed ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : { Vary: "Origin" };
  const fail = (code: ErrorCode) => Response.json({ error: code }, { status: STATUS[code], headers: cors });

  const path = new URL(request.url).pathname;
  if (path !== "/chat" && path !== "/lead") return new Response("Not found", { status: 404 });
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

  if (path === "/lead") {
    const copy = await request.text();
    if (copy.length > MAX_LEAD_CHARS) return fail("too_long");
    let form: unknown;
    try {
      form = JSON.parse(copy);
    } catch {
      return fail("bad_request");
    }
    const row = formRow(form);
    if (!row) return fail("bad_request");
    waitUntil(writeRow(env, row));
    return new Response(null, { status: 204, headers: cors });
  }

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
  // Leads captured this turn, for the lead sheet once the reply is out.
  const leads: Lead[] = [];
  // If the visitor closes the tab, writes fail; the turn just ends.
  const emit = (e: ChatEvent) => {
    if (e.event === "lead") leads.push(e.data);
    writer.write(encoder.encode(encodeEvent(e))).catch(() => {});
  };

  const userTurn = buildUserTurn(req);
  const work = (async () => {
    let append = [userTurn];
    try {
      append = await runTurn(call, req.history, userTurn, emit);
      const sig = await signHistory([...req.history, ...append], env.HISTORY_SECRET);
      emit({ event: "done", data: { append, sig } });
    } catch (err) {
      emit({ event: "error", data: { code: err instanceof AgentError ? err.code : "unavailable" } });
    } finally {
      await writer.close().catch(() => {});
      // After the visitor has their reply: one Sheet row per lead, with the conversation.
      if (leads.length) {
        const conversation = [...req.history, ...append];
        const before = countLeadCalls(req.history);
        await Promise.all(leads.map((lead, i) => writeRow(env, chatRow(lead, conversation, req.page.path, before + i > 0))));
      }
    }
  })();
  waitUntil(work);

  return new Response(readable, {
    headers: { ...cors, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store" },
  });
}
