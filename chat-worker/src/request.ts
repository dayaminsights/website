import type Anthropic from "@anthropic-ai/sdk";
import { MAX_HISTORY_MESSAGES, MAX_INPUT_CHARS, MAX_META_CHARS, PAGES } from "./config";

export interface ChatRequest {
  history: Anthropic.MessageParam[];
  sig?: string;
  input: string;
  page: { path: string; title: string; greeting?: string };
}

export type RequestError = { error: "too_long" | "bad_request" };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

export function parseChatRequest(body: unknown): ChatRequest | RequestError {
  if (!isObject(body)) return { error: "bad_request" };
  const history = body.history ?? [];
  if (!Array.isArray(history)) return { error: "bad_request" };
  if (history.length > MAX_HISTORY_MESSAGES) return { error: "too_long" };
  const input = str(body.input).trim();
  if (!input) return { error: "bad_request" };
  if (input.length > MAX_INPUT_CHARS) return { error: "too_long" };
  const page = isObject(body.page) ? body.page : {};
  const path = PAGES.includes(str(page.path)) ? str(page.path) : "/";
  const greeting = str(page.greeting).slice(0, MAX_META_CHARS);
  return {
    history: history as Anthropic.MessageParam[],
    sig: typeof body.sig === "string" ? body.sig : undefined,
    input,
    page: { path, title: str(page.title).slice(0, MAX_META_CHARS), ...(greeting ? { greeting } : {}) },
  };
}

/** Visitor text may not open a <page> note of its own. */
export function escapeNotes(s: string): string {
  return s.replace(/<(\/?)page/gi, "‹$1page");
}

function attr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The visitor's turn: the website's page note, then what they typed. */
export function buildUserTurn(req: ChatRequest): Anthropic.MessageParam {
  const attrs = [`path="${attr(req.page.path)}"`, `title="${attr(req.page.title)}"`];
  if (req.page.greeting) attrs.push(`greeting="${attr(req.page.greeting)}"`);
  return { role: "user", content: [{ type: "text", text: `<page ${attrs.join(" ")}/>\n\n${escapeNotes(req.input)}` }] };
}
