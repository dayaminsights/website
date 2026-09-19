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
