import type Anthropic from "@anthropic-ai/sdk";
import { MAX_FIELD_CHARS, PAGES, type Env } from "./config";
import type { Lead } from "./events";
import { transcript } from "./transcript";

/** One lead row. Keys match the FIELDS list in chat-worker/sheet/Code.gs. */
export type SheetRow = Partial<Record<
  "source" | "page" | "name" | "phone" | "email" | "business" | "website" | "systems" | "need" | "message" |
  "readiness" | "sector" | "country" | "city" | "preferred_time" | "pages_suggested" | "conversation", string>>;

const FORM_FIELDS = ["name", "phone", "email", "business", "website", "systems", "message"] as const;

function pagePath(p: string): string {
  if (p === "/" || p === "") return "/index.html";
  if (PAGES.includes(p)) return p;
  if (PAGES.includes(p + ".html")) return p + ".html";
  return "/";
}

/** A contact-form copy from site.js. Null when it names nobody. */
export function formRow(body: unknown): SheetRow | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, MAX_FIELD_CHARS) : "");
  const row: SheetRow = { source: "Contact form", page: pagePath(s(b.page)) };
  for (const f of FORM_FIELDS) {
    const v = s(b[f]);
    if (v) row[f] = v;
  }
  const need = s(b.intent);
  if (need) row.need = need;
  return row.name || row.phone ? row : null;
}

/** A chatbot lead, with the whole conversation so far as JSON. */
export function chatRow(lead: Lead, conversation: Anthropic.MessageParam[], page: string, update: boolean): SheetRow {
  const entries = transcript(conversation);
  const pages = [...new Set(entries.flatMap((e) => (e.from === "card" ? [e.page] : [])))];
  return {
    source: update ? "Chatbot update" : "Chatbot",
    page,
    name: lead.name,
    phone: lead.phone,
    business: lead.business,
    need: [lead.service, ...(lead.also ?? [])].join(", "),
    message: lead.need_summary,
    readiness: lead.readiness,
    sector: lead.sector,
    country: lead.country,
    city: lead.city,
    preferred_time: lead.preferred_time,
    pages_suggested: pages.join(", "),
    conversation: JSON.stringify(entries),
  };
}

/** Append one row through the Apps Script. The Sheet is a record, not the lead path: failures are logged, never thrown. */
export async function writeRow(env: Env, row: SheetRow): Promise<void> {
  if (!env.SHEET_URL || !env.SHEET_TOKEN) return;
  try {
    const res = await fetch(env.SHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: env.SHEET_TOKEN, row }),
      redirect: "follow",
    });
    const reply = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok || !reply?.ok) console.error(`sheet write failed: ${res.status} ${reply?.error ?? ""}`);
  } catch (err) {
    console.error(`sheet unreachable: ${String(err)}`);
  }
}
