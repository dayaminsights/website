import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { claudeCall, runTurn, type ModelCall } from "../src/agent";
import type { ChatEvent } from "../src/events";

type Block = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown };

function msg(stop: string, content: Block[]): Anthropic.Message {
  return {
    id: "msg",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5",
    stop_reason: stop,
    stop_sequence: null,
    content: content.map((b) => (b.type === "text" ? { ...b, citations: null } : b)),
    usage: { input_tokens: 1, output_tokens: 1 },
  } as unknown as Anthropic.Message;
}

function fake(replies: Anthropic.Message[]) {
  const calls: { messages: Anthropic.MessageParam[]; allowTools: boolean }[] = [];
  const fn: ModelCall = async (messages, onText, allowTools) => {
    calls.push({ messages: structuredClone(messages), allowTools });
    const next = replies.shift();
    if (!next) throw new Error("no more replies");
    for (const b of next.content) if (b.type === "text") onText(b.text);
    return next;
  };
  return { fn, calls };
}

const userTurn: Anthropic.MessageParam = { role: "user", content: [{ type: "text", text: '<page path="/index.html" title="Home"/>\n\nHi' }] };

describe("runTurn", () => {
  it("answers a plain question in one call", async () => {
    const { fn, calls } = fake([msg("end_turn", [{ type: "text", text: "We build dashboards." }])]);
    const events: ChatEvent[] = [];
    const append = await runTurn(fn, [], userTurn, (e) => events.push(e));
    expect(calls).toHaveLength(1);
    expect(calls[0].allowTools).toBe(true);
    expect(append.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(append[0]).toEqual(userTurn);
    expect(events).toEqual([{ event: "text", data: { delta: "We build dashboards." } }]);
  });

  it("sends earlier history ahead of the new turn", async () => {
    const history: Anthropic.MessageParam[] = [
      { role: "user", content: [{ type: "text", text: "earlier" }] },
      { role: "assistant", content: [{ type: "text", text: "reply" }] },
    ];
    const { fn, calls } = fake([msg("end_turn", [{ type: "text", text: "ok" }])]);
    await runTurn(fn, history, userTurn, () => {});
    expect(calls[0].messages).toEqual([...history, userTurn]);
  });

  it("ends the turn at the card when the message is already written", async () => {
    const { fn, calls } = fake([
      msg("tool_use", [
        { type: "text", text: "A live dashboard fixes that. Where does your stock live today?" },
        { type: "tool_use", id: "tu_1", name: "suggest_page", input: { page: "dashboards", reason: "Live numbers" } },
      ]),
    ]);
    const events: ChatEvent[] = [];
    const append = await runTurn(fn, [], userTurn, (e) => events.push(e));
    expect(calls).toHaveLength(1);
    expect(append.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect((append[2].content as Anthropic.ToolResultBlockParam[])[0]).toMatchObject({ type: "tool_result", tool_use_id: "tu_1" });
    expect(events.map((e) => e.event)).toEqual(["text", "card"]);
  });

  it("lets the model speak after a tool when it wrote nothing first", async () => {
    const { fn, calls } = fake([
      msg("tool_use", [{ type: "tool_use", id: "tu_1", name: "suggest_page", input: { page: "dashboards", reason: "Live numbers" } }]),
      msg("end_turn", [{ type: "text", text: "That page shows how it works." }]),
    ]);
    const append = await runTurn(fn, [], userTurn, () => {});
    expect(calls).toHaveLength(2);
    expect(calls[1].messages).toHaveLength(3);
    expect(append.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
  });

  it("lets the model recover when a tool call fails", async () => {
    const { fn, calls } = fake([
      msg("tool_use", [
        { type: "text", text: "Here is the page." },
        { type: "tool_use", id: "tu_1", name: "suggest_page", input: { page: "admin", reason: "x" } },
      ]),
      msg("end_turn", [{ type: "text", text: "Sorry, that page does not exist." }]),
    ]);
    await runTurn(fn, [], userTurn, () => {});
    expect(calls).toHaveLength(2);
  });

  it("accepts history that ends on tool results (the previous turn ended at a card)", async () => {
    const history: Anthropic.MessageParam[] = [
      { role: "user", content: [{ type: "text", text: "earlier" }] },
      { role: "assistant", content: [{ type: "text", text: "See this." }, { type: "tool_use", id: "tu_0", name: "suggest_page", input: { page: "faq", reason: "x" } }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "tu_0", content: "shown" }] },
    ];
    const { fn, calls } = fake([msg("end_turn", [{ type: "text", text: "ok" }])]);
    await runTurn(fn, history, userTurn, () => {});
    expect(calls[0].messages).toEqual([...history, userTurn]);
  });

  it("turns tools off after three rounds", async () => {
    const tool = (id: string) => msg("tool_use", [{ type: "tool_use", id, name: "handoff_whatsapp", input: { summary: "Hi" } }]);
    const { fn, calls } = fake([tool("a"), tool("b"), tool("c"), msg("end_turn", [{ type: "text", text: "Done." }])]);
    const append = await runTurn(fn, [], userTurn, () => {});
    expect(calls.map((c) => c.allowTools)).toEqual([true, true, true, false]);
    expect(append).toHaveLength(8);
  });

  it("keeps only the text when a reply is cut off mid tool call", async () => {
    const { fn } = fake([msg("max_tokens", [{ type: "text", text: "Let me" }, { type: "tool_use", id: "x", name: "capture_lead", input: {} }])]);
    const append = await runTurn(fn, [], userTurn, () => {});
    expect(append[1]).toEqual({ role: "assistant", content: [{ type: "text", text: "Let me" }] });
  });

  it("throws refused on a refusal, and keeps nothing", async () => {
    const { fn } = fake([msg("refusal", [])]);
    await expect(runTurn(fn, [], userTurn, () => {})).rejects.toMatchObject({ code: "refused" });
  });

  it("throws unavailable when the call fails", async () => {
    const fn: ModelCall = async () => {
      throw new Error("network");
    };
    await expect(runTurn(fn, [], userTurn, () => {})).rejects.toMatchObject({ code: "unavailable" });
  });
});

describe("claudeCall", () => {
  // A stand-in for the SDK client: records the request, returns a finished message.
  function client(reply: Anthropic.Message) {
    const requests: Record<string, unknown>[] = [];
    const c = { messages: { create: async (params: Record<string, unknown>) => { requests.push(params); return reply; } } };
    return { c: c as unknown as Anthropic, requests };
  }

  it("makes one non-streaming request and hands each text block over in order", async () => {
    const { c, requests } = client(msg("tool_use", [
      { type: "text", text: "First." },
      { type: "tool_use", id: "t", name: "suggest_page", input: {} },
      { type: "text", text: "Second." },
    ]));
    const texts: string[] = [];
    const message = await claudeCall(c)([userTurn], (t) => texts.push(t), true);
    expect(texts).toEqual(["First.", "Second."]);
    expect(message.stop_reason).toBe("tool_use");
    expect(requests).toHaveLength(1);
    expect(requests[0].stream).toBeUndefined();
    expect(requests[0].model).toBe("claude-sonnet-5");
    expect(requests[0].tool_choice).toEqual({ type: "auto" });
  });

  it("switches tools off when asked", async () => {
    const { c, requests } = client(msg("end_turn", [{ type: "text", text: "ok" }]));
    await claudeCall(c)([userTurn], () => {}, false);
    expect(requests[0].tool_choice).toEqual({ type: "none" });
  });
});
