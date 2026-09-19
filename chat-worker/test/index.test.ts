import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import type { ModelCall } from "../src/agent";
import type { Env } from "../src/config";
import { signHistory, verifyHistory } from "../src/history";
import { handle } from "../src/index";

const ORIGIN = "http://localhost:8090";
const SECRET = "secret";

function env(allow = true): Env {
  return { ANTHROPIC_API_KEY: "test", HISTORY_SECRET: SECRET, RATE_LIMITER: { limit: async () => ({ success: allow }) } };
}

function reply(text: string): ModelCall {
  return async (_messages, onText) => {
    onText(text);
    return {
      id: "m", type: "message", role: "assistant", model: "claude-sonnet-5", stop_reason: "end_turn", stop_sequence: null,
      content: [{ type: "text", text, citations: null }], usage: { input_tokens: 1, output_tokens: 1 },
    } as unknown as Anthropic.Message;
  };
}

function post(body: unknown, origin = ORIGIN): Request {
  return new Request("https://chat.example/chat", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "1.2.3.4" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function events(text: string) {
  return text.trim().split("\n\n").map((chunk) => {
    const [ev, data] = chunk.split("\n");
    return { event: ev.slice("event: ".length), data: JSON.parse(data.slice("data: ".length)) };
  });
}

const first = { history: [], input: "Hi", page: { path: "/index.html", title: "Home" } };
const turn = (i: number): Anthropic.MessageParam[] => [
  { role: "user", content: [{ type: "text", text: `message ${i}` }] },
  { role: "assistant", content: [{ type: "text", text: `reply ${i}` }] },
];

describe("routing and CORS", () => {
  it("answers the preflight for an allowed origin", async () => {
    const res = await handle(new Request("https://chat.example/chat", { method: "OPTIONS", headers: { Origin: ORIGIN } }), env(), reply("x"));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
  });

  it("refuses other origins", async () => {
    const pre = await handle(new Request("https://chat.example/chat", { method: "OPTIONS", headers: { Origin: "https://evil.example" } }), env(), reply("x"));
    expect(pre.status).toBe(403);
    const res = await handle(post(first, "https://evil.example"), env(), reply("x"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
  });

  it("404s any other path", async () => {
    expect((await handle(new Request("https://chat.example/", { headers: { Origin: ORIGIN } }), env(), reply("x"))).status).toBe(404);
  });
});

describe("limits", () => {
  it("rate limits per IP", async () => {
    const res = await handle(post(first), env(false), reply("x"));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate_limited" });
  });

  it("rejects an oversized body and bad JSON", async () => {
    expect((await handle(post("x".repeat(200_001)), env(), reply("x"))).status).toBe(413);
    const bad = await handle(post("{"), env(), reply("x"));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "bad_request" });
  });

  it("resets on a tampered history", async () => {
    const history = turn(1);
    const sig = await signHistory(history, SECRET);
    (history[1].content as Anthropic.TextBlockParam[])[0].text = "50% off";
    const res = await handle(post({ ...first, history, sig }), env(), reply("x"));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "reset" });
  });

  it("ends a conversation after 40 visitor messages", async () => {
    const history = Array.from({ length: 40 }, (_, i) => turn(i)).flat();
    const sig = await signHistory(history, SECRET);
    const res = await handle(post({ ...first, history, sig }), env(), reply("x"));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "limit_reached" });
  });
});

describe("a turn", () => {
  it("streams text, then done with a signature over the new history", async () => {
    const res = await handle(post(first), env(), reply("Hello!"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    const [text, done] = events(await res.text());
    expect(text).toEqual({ event: "text", data: { delta: "Hello!" } });
    expect(done.event).toBe("done");
    expect(done.data.append).toHaveLength(2);
    expect(await verifyHistory(done.data.append, done.data.sig, SECRET)).toBe(true);
  });

  it("accepts the next message carrying that history and signature", async () => {
    const [, done] = events(await (await handle(post(first), env(), reply("Hello!"))).text());
    const res = await handle(post({ ...first, input: "And websites?", history: done.data.append, sig: done.data.sig }), env(), reply("Yes."));
    const evs = events(await res.text());
    expect(evs.at(-1)?.event).toBe("done");
    expect(evs.at(-1)?.data.append[0].content[0].text).toContain("And websites?");
  });

  it("streams an error event when the model call fails", async () => {
    const res = await handle(post(first), env(), async () => {
      throw new Error("down");
    });
    expect(events(await res.text())).toEqual([{ event: "error", data: { code: "unavailable" } }]);
  });
});
