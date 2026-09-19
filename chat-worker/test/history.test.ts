import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { countVisitorTurns, signHistory, verifyHistory } from "../src/history";

const SECRET = "test-secret";
const history: Anthropic.MessageParam[] = [
  { role: "user", content: [{ type: "text", text: '<page path="/faq.html" title="FAQ"/>\n\nHello' }] },
  { role: "assistant", content: [{ type: "text", text: "Hi, what does the business do?" }] },
];

describe("history signature", () => {
  it("accepts the history it signed", async () => {
    const sig = await signHistory(history, SECRET);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifyHistory(history, sig, SECRET)).toBe(true);
  });

  it("accepts an empty history without a signature", async () => {
    expect(await verifyHistory([], undefined, SECRET)).toBe(true);
  });

  it("rejects an edited history", async () => {
    const sig = await signHistory(history, SECRET);
    const edited = structuredClone(history);
    (edited[1].content as Anthropic.TextBlockParam[])[0].text = "Sure, 50% off.";
    expect(await verifyHistory(edited, sig, SECRET)).toBe(false);
  });

  it("rejects a missing or malformed signature on a non-empty history", async () => {
    expect(await verifyHistory(history, undefined, SECRET)).toBe(false);
    expect(await verifyHistory(history, "abc", SECRET)).toBe(false);
  });

  it("rejects a signature made with another secret", async () => {
    const sig = await signHistory(history, "other-secret");
    expect(await verifyHistory(history, sig, SECRET)).toBe(false);
  });
});

describe("countVisitorTurns", () => {
  it("counts user turns that carry text, not tool results", () => {
    const h: Anthropic.MessageParam[] = [
      ...history,
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "ok" }] },
      { role: "user", content: [{ type: "text", text: "second" }] },
    ];
    expect(countVisitorTurns(h)).toBe(2);
  });
});
