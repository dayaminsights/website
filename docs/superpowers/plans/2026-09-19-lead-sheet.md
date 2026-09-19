# Lead Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record every website lead (contact form and chatbot) as a row in a Google Sheet in the owner's account. Chatbot rows carry the conversation as JSON.

**Architecture:**
- The Worker gets a `sheet.ts` module (row builders plus one `writeRow` that posts to an Apps Script web app) and a `transcript.ts` module (history → JSON).
- `/chat` writes a row for each `capture_lead` after the reply has streamed.
- A new `/lead` route takes contact-form copies from `site.js`.
- The Apps Script (`chat-worker/sheet/Code.gs`) appends rows under a lock and neutralises formulas.

**Tech Stack:** TypeScript Worker + vitest (existing), Google Apps Script, vanilla JS in `site.js`, and the existing Playwright suite.

**Spec:** `docs/superpowers/specs/2026-09-19-lead-sheet-design.md`

**Repo rules:**
- Other sessions edit this working tree, so commit with explicit paths (`git commit -- <paths>`) and never `git add -A`.
- `tools/` is local and gitignored.

---

### Task 1: Conversation → JSON

**Files:** Create `chat-worker/src/transcript.ts`; Test `chat-worker/test/transcript.test.ts`

- [ ] **Step 1: Failing test**

```ts
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
```

- [ ] **Step 2:** `cd chat-worker && npx vitest run test/transcript.test.ts`. Expected: FAIL, cannot resolve `../src/transcript`.

- [ ] **Step 3: Implement**

```ts
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
```

- [ ] **Step 4:** Re-run it. Expected: PASS, 3 tests.
- [ ] **Step 5:** Commit `chat-worker/src/transcript.ts chat-worker/test/transcript.test.ts`.

### Task 2: Rows and the Sheet write

**Files:**
- Create `chat-worker/src/sheet.ts`; Test `chat-worker/test/sheet.test.ts`
- Modify `chat-worker/src/config.ts`: add `SHEET_URL?`/`SHEET_TOKEN?` to `Env`, plus `MAX_FIELD_CHARS = 2000` and `MAX_LEAD_CHARS = 20_000`.

- [ ] **Step 1: Failing test**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import type { Env } from "../src/config";
import { chatRow, formRow, writeRow } from "../src/sheet";

const lead = { name: "Asha", phone: "+971 50 000 0000", need_summary: "Two clinics.", service: "chatbot", also: ["website"], readiness: "ready_to_talk", sector: "clinic", country: "uae", city: "Dubai" } as const;
const convo: Anthropic.MessageParam[] = [
  { role: "user", content: [{ type: "text", text: '<page path="/index.html" title="H"/>\n\nHi' }] },
  { role: "assistant", content: [{ type: "text", text: "Hello." }, { type: "tool_use", id: "a", name: "suggest_page", input: { page: "chatbot", reason: "x" } }] },
];
const env = (url = "https://script.example/exec"): Env =>
  ({ ANTHROPIC_API_KEY: "k", HISTORY_SECRET: "s", SHEET_URL: url, SHEET_TOKEN: "t", RATE_LIMITER: { limit: async () => ({ success: true }) } }) as Env;

afterEach(() => vi.unstubAllGlobals());

describe("formRow", () => {
  it("keeps the form's fields, maps intent to need, drops the rest", () => {
    expect(formRow({ page: "/dashboards.html", name: " Ravi ", phone: "98765", business: "RK", systems: "Tally", intent: "Dashboards & reporting", message: "Sales report", _honey: "", junk: "x" })).toEqual({
      source: "Contact form", page: "/dashboards.html", name: "Ravi", phone: "98765", business: "RK", systems: "Tally", need: "Dashboards & reporting", message: "Sales report",
    });
  });
  it("normalises pretty and unknown paths", () => {
    expect(formRow({ page: "/websites", name: "a" })?.page).toBe("/websites.html");
    expect(formRow({ page: "/", name: "a" })?.page).toBe("/index.html");
    expect(formRow({ page: "/x", name: "a" })?.page).toBe("/");
  });
  it("cuts long fields and refuses a copy with neither name nor phone", () => {
    expect(formRow({ name: "a".repeat(5000) })?.name).toHaveLength(2000);
    expect(formRow({ message: "hi" })).toBeNull();
    expect(formRow("nope")).toBeNull();
  });
});

describe("chatRow", () => {
  it("carries the classification, the pages suggested and the conversation as JSON", () => {
    const row = chatRow(lead as never, convo, "/ai-chatbot.html", false);
    expect(row).toMatchObject({ source: "Chatbot", page: "/ai-chatbot.html", name: "Asha", need: "chatbot, website", message: "Two clinics.", readiness: "ready_to_talk", country: "uae", city: "Dubai", pages_suggested: "chatbot" });
    expect(JSON.parse(row.conversation!)).toEqual([{ from: "visitor", text: "Hi" }, { from: "assistant", text: "Hello." }, { from: "card", page: "chatbot" }]);
    expect(chatRow(lead as never, convo, "/", true).source).toBe("Chatbot update");
  });
});

describe("writeRow", () => {
  it("posts the row with the secret", async () => {
    const f = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", f);
    await writeRow(env(), { source: "Contact form", name: "a" });
    expect(f).toHaveBeenCalledOnce();
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://script.example/exec");
    expect(JSON.parse(init.body as string)).toEqual({ token: "t", row: { source: "Contact form", name: "a" } });
  });
  it("does nothing when the Sheet is not set up", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await writeRow(env(""), { name: "a" });
    expect(f).not.toHaveBeenCalled();
  });
  it("never throws when the Sheet is down or refuses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    await expect(writeRow(env(), { name: "a" })).resolves.toBeUndefined();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: false, error: "forbidden" })));
    await expect(writeRow(env(), { name: "a" })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2:** Run it. Expected: FAIL, cannot resolve `../src/sheet`.

- [ ] **Step 3: Implement** `config.ts` additions:

```ts
export const MAX_FIELD_CHARS = 2000;
export const MAX_LEAD_CHARS = 20_000;
// in Env:
  /** The Apps Script web app that appends rows to the lead sheet; unset = no Sheet writes. */
  SHEET_URL?: string;
  SHEET_TOKEN?: string;
```

`sheet.ts`:

```ts
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
```

- [ ] **Step 4:** Re-run it. Expected: PASS, 7 tests.
- [ ] **Step 5:** Commit `chat-worker/src/sheet.ts chat-worker/src/config.ts chat-worker/test/sheet.test.ts`.

### Task 3: `/lead`, and chatbot leads written from `/chat`

**Files:** Modify `chat-worker/src/index.ts`; Test `chat-worker/test/index.test.ts` (append)

- [ ] **Step 1: Failing tests** (append to `index.test.ts`; add `vi` to the vitest import and `afterEach(() => vi.unstubAllGlobals())`)

```ts
function sheetEnv(): Env {
  return { ...env(), SHEET_URL: "https://script.example/exec", SHEET_TOKEN: "t" };
}
function leadPost(body: unknown, origin = ORIGIN): Request {
  return new Request("https://chat.example/lead", { method: "POST", headers: { Origin: origin, "Content-Type": "text/plain", "CF-Connecting-IP": "1.2.3.4" }, body: JSON.stringify(body) });
}

describe("/lead", () => {
  it("forwards a contact-form copy to the Sheet and answers 204", async () => {
    const f = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", f);
    const waits: Promise<unknown>[] = [];
    const res = await handle(leadPost({ page: "/index.html", name: "Ravi", phone: "98765", intent: "A website", message: "New site" }), sheetEnv(), reply("x"), (p) => waits.push(p));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    await Promise.all(waits);
    expect(JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).row).toMatchObject({ source: "Contact form", name: "Ravi", need: "A website" });
  });
  it("refuses other origins, nameless copies and bad JSON", async () => {
    expect((await handle(leadPost({ name: "a" }, "https://evil.example"), sheetEnv(), reply("x"))).status).toBe(403);
    expect((await handle(leadPost({ message: "hi" }), sheetEnv(), reply("x"))).status).toBe(400);
    const bad = new Request("https://chat.example/lead", { method: "POST", headers: { Origin: ORIGIN }, body: "{" });
    expect((await handle(bad, sheetEnv(), reply("x"))).status).toBe(400);
  });
});

describe("chatbot leads in the Sheet", () => {
  const leadTurn = (): ModelCall => async (_m, onText) => {
    onText("Thanks Asha.");
    return {
      id: "m", type: "message", role: "assistant", model: "claude-sonnet-5", stop_reason: "tool_use", stop_sequence: null,
      content: [
        { type: "text", text: "Thanks Asha.", citations: null },
        { type: "tool_use", id: "tl", name: "capture_lead", input: { name: "Asha", phone: "98765", need_summary: "Clinic.", service: "chatbot", readiness: "ready_to_talk", sector: "clinic", country: "uae" } },
      ],
      usage: { input_tokens: 1, output_tokens: 1 },
    } as unknown as Anthropic.Message;
  };

  it("writes one row per captured lead, with the conversation, after the reply", async () => {
    const f = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", f);
    const waits: Promise<unknown>[] = [];
    const res = await handle(post({ ...first, input: "I am Asha, 98765" }), sheetEnv(), leadTurn(), (p) => waits.push(p));
    await res.text();
    await Promise.all(waits);
    expect(f).toHaveBeenCalledOnce();
    const row = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).row;
    expect(row).toMatchObject({ source: "Chatbot", name: "Asha", page: "/index.html", need: "chatbot" });
    expect(JSON.parse(row.conversation)).toEqual([{ from: "visitor", text: "I am Asha, 98765" }, { from: "assistant", text: "Thanks Asha." }, { from: "lead" }]);
  });

  it("marks a lead as an update when the conversation already has one", async () => {
    const f = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", f);
    const [, done] = events(await (await handle(post({ ...first, input: "I am Asha" }), sheetEnv(), leadTurn())).text());
    const waits: Promise<unknown>[] = [];
    await (await handle(post({ ...first, input: "Call Tuesday", history: done.data.append, sig: done.data.sig }), sheetEnv(), leadTurn(), (p) => waits.push(p))).text();
    await Promise.all(waits);
    const last = f.mock.calls.at(-1) as unknown as [string, RequestInit];
    expect(JSON.parse(last[1].body as string).row.source).toBe("Chatbot update");
  });

  it("writes nothing when no lead was captured", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const waits: Promise<unknown>[] = [];
    await (await handle(post(first), sheetEnv(), reply("Hello"), (p) => waits.push(p))).text();
    await Promise.all(waits);
    expect(f).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2:** Run `npx vitest run test/index.test.ts`. Expected: the new tests FAIL (404 on `/lead`, no fetch calls).

- [ ] **Step 3: Implement in `index.ts`**
  - Import `MAX_LEAD_CHARS`, `type Lead`, `chatRow, formRow, writeRow`, `countLeadCalls`.
  - Accept both paths:
    ```ts
    const path = new URL(request.url).pathname;
    if (path !== "/chat" && path !== "/lead") return new Response("Not found", { status: 404 });
    ```
  - After the rate-limit check:
    ```ts
    if (path === "/lead") {
      const raw = await request.text();
      if (raw.length > MAX_LEAD_CHARS) return fail("too_long");
      let copy: unknown;
      try { copy = JSON.parse(raw); } catch { return fail("bad_request"); }
      const row = formRow(copy);
      if (!row) return fail("bad_request");
      waitUntil(writeRow(env, row));
      return new Response(null, { status: 204, headers: cors });
    }
    ```
  - In the `/chat` part: collect leads in `emit` (`if (e.event === "lead") leads.push(e.data);`). Keep the user turn in a variable, and track `append` (starting as `[userTurn]`, replaced by `runTurn`'s result). In `finally`, close the writer first, then:
    ```ts
    const conversation = [...req.history, ...append];
    const before = countLeadCalls(req.history);
    await Promise.all(leads.map((lead, i) => writeRow(env, chatRow(lead, conversation, req.page.path, before + i > 0))));
    ```

- [ ] **Step 4:** Run `npx vitest run`. Expected: all pass (50 + 3 + 7 + 5 = 65).
- [ ] **Step 5:** Commit `chat-worker/src/index.ts chat-worker/test/index.test.ts`.

### Task 4: The Apps Script

**Files:** Create `chat-worker/sheet/Code.gs`

- [ ] **Step 1: Write it**

```js
/* Dayam Insights: the lead sheet. One row per website lead (contact form or chatbot).
   Setup, once:
     1. In the Google Sheet: Extensions → Apps Script, paste this file over Code.gs, save.
     2. Project Settings (gear) → Script properties → add SHEET_TOKEN = the secret the Worker uses.
     3. Deploy → New deployment → type "Web app"; Execute as: Me; Who has access: Anyone → Deploy,
        allow access, copy the Web app URL. The Worker stores that URL as SHEET_URL.
   Redeploying after an edit: Deploy → Manage deployments → edit → Version: New version,
   which keeps the same URL. */

var HEADERS = ['Received', 'Source', 'Page', 'Name', 'Phone', 'Email', 'Business', 'Website', 'Systems', 'Need', 'Message',
  'Readiness', 'Sector', 'Country', 'City', 'Preferred call time', 'Pages suggested', 'Conversation (JSON)'];
// Row keys sent by the Worker (chat-worker/src/sheet.ts SheetRow), in column order; null is the timestamp.
var FIELDS = [null, 'source', 'page', 'name', 'phone', 'email', 'business', 'website', 'systems', 'need', 'message',
  'readiness', 'sector', 'country', 'city', 'preferred_time', 'pages_suggested', 'conversation'];

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return reply({ ok: false, error: 'bad json' }); }
  var token = PropertiesService.getScriptProperties().getProperty('SHEET_TOKEN');
  if (!token || !body || body.token !== token) return reply({ ok: false, error: 'forbidden' });
  var row = body.row || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var book = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = book.getSheetByName('Leads') || book.insertSheet('Leads');
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    }
    var received = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm');
    sheet.appendRow(FIELDS.map(function (f) { return f ? safe(row[f]) : received; }));
  } finally {
    lock.releaseLock();
  }
  return reply({ ok: true });
}

// A visitor's words must never run as a formula: anything starting = + - @ is kept as text.
function safe(v) {
  if (v === undefined || v === null) return '';
  var s = String(v).slice(0, 45000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function reply(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
```

- [ ] **Step 2:** Check `FIELDS` against `SheetRow`: `node -e` prints the keys of both and compares them. Expected: identical sets.
- [ ] **Step 3:** Commit `chat-worker/sheet/Code.gs`.

### Task 5: Contact forms send a copy

**Files:** Modify `assets/js/site.js` (contact-form submit handler); local suite `tools/checks/chat.js`

- [ ] **Step 1: Failing check** (in `tools/checks/chat.js`, before the lead block):

```js
  // --- Contact forms send a copy to the Worker for the lead sheet.
  {
    const { ctx, p } = await open('dashboards.html');
    const copies = [];
    await p.route('http://localhost:8787/lead', (route) => { copies.push(route.request().postData()); route.fulfill({ status: 204, headers: CORS }); });
    await p.fill('.contact-form [name=name]', 'Ravi Test');
    await p.fill('.contact-form [name=business]', 'RK Stores');
    await p.fill('.contact-form [name=phone]', '+91 98765 00000');
    await p.fill('.contact-form [name=systems]', 'Tally');
    await p.fill('.contact-form [name=message]', 'Weekly sales report by hand');
    await p.click('.contact-form .cf-submit');
    await p.waitForTimeout(800);
    const copy = copies[0] ? JSON.parse(copies[0]) : {};
    ok(copies.length === 1, 'contact form sends one copy to /lead');
    ok(copy.name === 'Ravi Test' && copy.systems === 'Tally' && copy.page === '/dashboards.html' && copy.intent && !('_subject' in copy), 'copy carries the form fields and page, not FormSubmit settings');
    await ctx.close();
  }
```

- [ ] **Step 2:** Run `node tools/checks/chat.js`. Expected: the two new lines FAIL.

- [ ] **Step 3: Implement in `site.js`.** Add a function before the submit handler, and call `copyLead(contactForm);` directly after `e.preventDefault();` in the handler:

```js
  // A copy of each enquiry goes to the chat Worker, which adds it to the lead sheet
  // (chat-worker/src/sheet.ts). Same Worker as PROD_ENDPOINT in chat.js. Fire and forget:
  // keepalive lets it finish even if the native-POST fallback navigates away; text/plain
  // keeps it a simple request, so there is no CORS preflight.
  var LEAD_COPY = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? 'http://localhost:8787/lead'
    : 'https://dayam-chat.dayam-chat-worker.workers.dev/lead';
  function copyLead(form){
    var honey = form.querySelector('[name="_honey"]');
    if (honey && honey.value) return;
    var data = { page: location.pathname };
    new FormData(form).forEach(function(v, k){ if (k.charAt(0) !== '_' && typeof v === 'string') data[k] = v; });
    try {
      fetch(LEAD_COPY, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(data), keepalive: true }).catch(function(){});
    } catch (err) {}
  }
```

- [ ] **Step 4:** Run `node tools/checks/chat.js`. Expected: `all passed`.
- [ ] **Step 5:** Commit `assets/js/site.js`.

### Task 6: Privacy, deploy, owner setup, live test

- [ ] **Step 1:** `privacy.html`: in "What you send us", after the FormSubmit paragraph, add a paragraph saying copies of enquiries (the form and the chat) are also kept in a private Google Sheet in our Google account, including the conversation for chat enquiries. In the chat section, change "We do not store the conversation on our side" to cover the case where someone leaves details. Commit `privacy.html`.
- [ ] **Step 2:** `cd chat-worker && npx wrangler deploy`. With `SHEET_URL` unset, writes are skipped.
- [ ] **Step 3:** Generate the token (`node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`) and run `npx wrangler secret put SHEET_TOKEN` with it. Give the owner the token and the Code.gs steps.
- [ ] **Step 4:** Once the owner sends the web app URL: `npx wrangler secret put SHEET_URL`. Then send a test copy with `curl` to `/lead` (`Origin: https://dayaminsights.com`, name "TEST — delete me"), and have the owner confirm the row.
- [ ] **Step 5:** Notes entry (temporary-index commit of our lines only).
