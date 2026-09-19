import type Anthropic from "@anthropic-ai/sdk";

export type Entry =
  | { from: "visitor"; text: string }
  | { from: "assistant"; text: string }
  | { from: "card"; page: string }
  | { from: "whatsapp" }
  | { from: "lead" };

const PAGE_NOTE = /^<page\b[^>]*\/>\s*/;

/** The conversation as the owner would read it: who said what, and where a card or lead landed. */
export function transcript(history: Anthropic.MessageParam[]): Entry[] {
  const out: Entry[] = [];
  for (const m of history) {
    const blocks = typeof m.content === "string" ? [{ type: "text" as const, text: m.content }] : m.content;
    for (const b of blocks) {
      if (b.type === "text") {
        const text = (m.role === "user" ? b.text.replace(PAGE_NOTE, "") : b.text).trim();
        if (text) out.push({ from: m.role === "user" ? "visitor" : "assistant", text });
      } else if (b.type === "tool_use") {
        if (b.name === "suggest_page") out.push({ from: "card", page: String((b.input as { page?: unknown })?.page ?? "") });
        else if (b.name === "handoff_whatsapp") out.push({ from: "whatsapp" });
        else if (b.name === "capture_lead") out.push({ from: "lead" });
      }
    }
  }
  return out;
}

export function countLeadCalls(history: Anthropic.MessageParam[]): number {
  let n = 0;
  for (const m of history) {
    if (m.role !== "assistant" || typeof m.content === "string") continue;
    for (const b of m.content) if (b.type === "tool_use" && b.name === "capture_lead") n++;
  }
  return n;
}
