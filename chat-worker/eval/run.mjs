// Conversation eval: scripted visitors against a running Worker.
//   Tuning:  npm run dev (key in .dev.vars), then  npm run eval
//   Launch:  BASE=https://<worker url> ORIGIN=https://dayaminsights.com npm run eval
//   Subset:  ONLY=2,3,16 npm run eval
// Prints one line per scenario and writes every transcript to eval/out/NN.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || "http://localhost:8787";
const ORIGIN = process.env.ORIGIN || "http://localhost:8090";
const DELAY = Number(process.env.EVAL_DELAY_MS || 6500); // stays under 10 requests a minute per IP
const ONLY = process.env.ONLY ? process.env.ONLY.split(",").map(Number) : null;

const PRICE = /₹\s?\d|\$\s?\d|\b(rs|inr|aed|usd)\.?\s?\d|\d[\d,.]*\s?(k|lakhs?|crores?|aed|inr|usd|dirhams?|rupees?)\b|\d[\d,.]*\s?(रुपये|रु\.?|درهم)/i;
// A real contact ask always asks for a name; "phone number" alone also appears in answers about websites.
const CONTACT_ASK = /\byour name\b|\bname and (a |your )?(phone|whatsapp|mobile|number)\b/i;
// Whole words only: "our Dubai" must not match inside "your Dubai".
const says = (text, phrase) => new RegExp("(^|[^\\p{L}])" + phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^\\p{L}])", "iu").test(text);
const DEVANAGARI = /[ऀ-ॿ]/g;
const ARABIC = /[؀-ۿ]/g;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const share = (text, re) => (text.match(re) || []).length / (text.replace(/[\s\d\p{P}\p{S}]/gu, "").length || 1);

async function turn(state, page, input) {
  const body = { history: state.history, input, page: { path: page, title: "Eval" } };
  if (state.sig) body.sig = state.sig;
  // `segments` splits the reply at each tool event, so text written after a tool call is visible.
  const out = { text: "", segments: [""], cards: [], leads: [], error: null };
  let res;
  try {
    res = await fetch(BASE + "/chat", { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN }, body: JSON.stringify(body) });
  } catch (e) {
    out.error = "fetch failed: " + e.message;
    return out;
  }
  if (!res.ok) {
    out.error = (await res.json().catch(() => ({}))).error || `HTTP ${res.status}`;
    return out;
  }
  for (const chunk of (await res.text()).split("\n\n")) {
    const ev = /^event: (.+)$/m.exec(chunk)?.[1];
    const data = /^data: (.+)$/m.exec(chunk)?.[1];
    if (!ev || !data) continue;
    const d = JSON.parse(data);
    if (ev === "text") { out.text += d.delta; out.segments[out.segments.length - 1] += d.delta; }
    else if (ev === "card") { out.cards.push(d); out.segments.push(""); }
    else if (ev === "lead") { out.leads.push(d); out.segments.push(""); }
    else if (ev === "done") { state.history = state.history.concat(d.append); state.sig = d.sig; }
    else if (ev === "error") out.error = d.code;
  }
  return out;
}

function check(s, turns) {
  const c = s.check || {};
  const bot = turns.map((t) => t.text).join("\n");
  const cards = turns.flatMap((t) => t.cards);
  const leads = turns.flatMap((t) => t.leads);
  const last = leads[leads.length - 1];
  const fails = [];
  const errors = turns.map((t) => t.error).filter(Boolean);
  if (errors.length) fails.push("errors: " + errors.join(", "));
  // The rules say: whole message first, then the tool, then stop. Text on both sides of a tool
  // call is a repeat; text only after it is fine (the model called the tool first, then spoke).
  const repeated = (t) => {
    const seg = (t.segments || []).map((s) => s.trim());
    return seg.some((s, i) => s && seg.slice(i + 1).some(Boolean));
  };
  if (!c.allowAfterTool && turns.some(repeated)) fails.push("wrote on both sides of a tool call (repeats itself?)");
  if (c.noPrice !== false && PRICE.test(bot)) fails.push("price-like text: " + bot.match(PRICE)[0]);
  if (c.page && !cards.some((k) => k.kind === "page" && k.page === c.page)) fails.push(`no page card for ${c.page}`);
  if (c.anyPage && !cards.some((k) => k.kind === "page")) fails.push("no page card");
  if (c.whatsapp && !cards.some((k) => k.kind === "whatsapp")) fails.push("no WhatsApp card");
  if (c.noCards && cards.length) fails.push("showed a card it should not have");
  if (c.noLead && leads.length) fails.push("captured a lead it should not have");
  // Once a need is clear the visitor must be offered a way to leave details without having to ask how.
  // The bot's own question counts, and so does a page card: the widget puts an "Ask the team to get in
  // touch" button under every page card until details are given (the model forgets the question now and then).
  const cardShown = cards.some((k) => k.kind === "page");
  if (c.asksContact && !leads.length && !cardShown && !CONTACT_ASK.test(turns[turns.length - 1].text)) fails.push("did not ask for contact details");
  if (c.noAskContact && CONTACT_ASK.test(bot)) fails.push("asked for contact details before any need was described");
  // Not a failure, but worth seeing: a page card whose message skipped the contact question.
  if (c.askWithCard) {
    let captured = false;
    turns.forEach((t, i) => {
      if (!captured && t.cards.some((k) => k.kind === "page") && !CONTACT_ASK.test(t.text)) (s.notes ||= []).push(`turn ${i + 1}: page card without the contact question in text (the widget button covers it)`);
      if (t.leads.length) captured = true;
    });
  }
  const match = (want) => {
    for (const [k, v] of Object.entries(want)) {
      if (v === true ? !last[k] : last[k] !== v) fails.push(`lead.${k} = ${JSON.stringify(last[k])}, want ${v === true ? "present" : JSON.stringify(v)}`);
    }
  };
  if (c.lead) { if (!last) fails.push("no lead captured"); else match(c.lead); }
  if (c.leadIf && last) match(c.leadIf);
  if (c.lang === "hi" && share(bot, DEVANAGARI) < 0.5) fails.push("not in Hindi (Devanagari)");
  if (c.lang === "ar" && share(bot, ARABIC) < 0.5) fails.push("not in Arabic");
  if (c.lang === "latin" && (share(bot, DEVANAGARI) > 0.05 || share(bot, ARABIC) > 0.05)) fails.push("expected Latin script");
  for (const w of c.mustSay || []) if (!says(bot, w)) fails.push(`did not say "${w}"`);
  for (const w of c.mustNotSay || []) if (says(bot, w)) fails.push(`said "${w}"`);
  return fails;
}

const scenarios = JSON.parse(fs.readFileSync(path.join(here, "scenarios.json"), "utf8"));
fs.mkdirSync(path.join(here, "out"), { recursive: true });
let failed = 0, ran = 0;
for (const s of scenarios) {
  if (ONLY && !ONLY.includes(s.id)) continue;
  ran++;
  const state = { history: [], sig: "" };
  const turns = [];
  for (const input of s.turns) {
    turns.push({ input, ...(await turn(state, s.page, input)) });
    await sleep(DELAY);
  }
  const fails = check(s, turns);
  if (fails.length) failed++;
  console.log(
    `${fails.length ? "FAIL" : "ok  "} ${String(s.id).padStart(2)}  ${s.name}` +
      (fails.length ? "\n        " + fails.join("\n        ") : "") +
      (s.notes ? "\n        note: " + s.notes.join("\n        note: ") : "") +
      (s.manual ? "\n        read: " + s.manual : ""),
  );
  const md = [`# ${s.id}. ${s.name}`, `page: ${s.page}`, s.manual ? `read for: ${s.manual}` : "", ""]
    .concat(turns.flatMap((t) => [
      `**Visitor:** ${t.input}`, "", `**Bot:** ${(t.segments || [t.text]).filter((s) => s.trim()).join("\n\n> …after a tool call:\n\n") || "(no text)"}`,
      ...t.cards.map((k) => `> card: ${JSON.stringify(k)}`),
      ...t.leads.map((l) => `> lead: ${JSON.stringify(l)}`),
      t.error ? `> error: ${t.error}` : "", "",
    ]))
    .join("\n");
  fs.writeFileSync(path.join(here, "out", `${String(s.id).padStart(2, "0")}.md`), md);
}
console.log(`\n${ran - failed}/${ran} passed the automated checks. Read eval/out/*.md for the "read:" items.`);
process.exit(failed ? 1 : 0);
