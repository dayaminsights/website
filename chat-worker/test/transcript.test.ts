import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { countLeadCalls, transcript } from "../src/transcript";

const history: Anthropic.MessageParam[] = [
  { role: "user", content: [{ type: "text", text: '<page path="/index.html" title="Home" greeting="Hi"/>\n\nWe have 4 shops' }] },
  { role: "assistant", content: [
    { type: "text", text: "A dashboard fits." },
    { type: "tool_use", id: "a", name: "suggest_page", input: { page: "dashboards", reason: "x" } },
  ] },
  { role: "user", content: [{ type: "tool_result", tool_use_id: "a", content: "shown" }] },
  { role: "user", content: [{ type: "text", text: '<page path="/dashboards.html" title="D"/>\n\nI am Asha, 98765' }] },
  { role: "assistant", content: [
    { type: "text", text: "Thanks Asha." },
    { type: "tool_use", id: "b", name: "capture_lead", input: {} },
    { type: "tool_use", id: "c", name: "handoff_whatsapp", input: { summary: "Hi" } },
  ] },
];

describe("transcript", () => {
  it("keeps visitor and assistant text, marks tool calls, drops page notes and tool results", () => {
    expect(transcript(history)).toEqual([
      { from: "visitor", text: "We have 4 shops" },
      { from: "assistant", text: "A dashboard fits." },
      { from: "card", page: "dashboards" },
      { from: "visitor", text: "I am Asha, 98765" },
      { from: "assistant", text: "Thanks Asha." },
      { from: "lead" },
      { from: "whatsapp" },
    ]);
  });

  it("handles plain-string content", () => {
    expect(transcript([{ role: "user", content: "hello" }, { role: "assistant", content: "hi" }])).toEqual([
      { from: "visitor", text: "hello" },
      { from: "assistant", text: "hi" },
    ]);
  });

  it("counts capture_lead calls", () => {
    expect(countLeadCalls(history)).toBe(1);
    expect(countLeadCalls([])).toBe(0);
  });
});
