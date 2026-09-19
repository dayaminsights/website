import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { encodeEvent, type ChatEvent } from "../src/events";
import { PAGE_TARGETS, TOOLS, runTool } from "../src/tools";

const use = (name: string, input: unknown) =>
  ({ type: "tool_use", id: "tu_1", name, input }) as Anthropic.ToolUseBlock;

function collect() {
  const events: ChatEvent[] = [];
  return { events, emit: (e: ChatEvent) => events.push(e) };
}

describe("runTool", () => {
  it("turns suggest_page into a page card", () => {
    const { events, emit } = collect();
    const res = runTool(use("suggest_page", { page: "dashboards", reason: "Your weekly report, live" }), emit);
    expect(events).toEqual([
      { event: "card", data: { kind: "page", page: "dashboards", href: "/dashboards.html#questions", reason: "Your weekly report, live" } },
    ]);
    expect(res).toMatchObject({ type: "tool_result", tool_use_id: "tu_1" });
    expect(res.is_error).toBeUndefined();
  });

  it("rejects a page target outside the list", () => {
    const { events, emit } = collect();
    expect(runTool(use("suggest_page", { page: "admin", reason: "x" }), emit).is_error).toBe(true);
    expect(events).toEqual([]);
  });

  it("turns capture_lead into a lead event", () => {
    const { events, emit } = collect();
    const lead = { name: "Asha", phone: "+971 50 000 0000", need_summary: "Clinic in Dubai.", service: "chatbot", readiness: "ready_to_talk", sector: "clinic", country: "uae" };
    runTool(use("capture_lead", lead), emit);
    expect(events).toEqual([{ event: "lead", data: lead }]);
  });

  it("turns handoff_whatsapp into a WhatsApp card", () => {
    const { events, emit } = collect();
    runTool(use("handoff_whatsapp", { summary: "Hi, I need a quote." }), emit);
    expect(events).toEqual([{ event: "card", data: { kind: "whatsapp", summary: "Hi, I need a quote." } }]);
  });

  it("errors on an unknown tool", () => {
    expect(runTool(use("delete_everything", {}), () => {}).is_error).toBe(true);
  });
});

describe("TOOLS", () => {
  it("are strict and closed", () => {
    expect(TOOLS.map((t) => t.name)).toEqual(["suggest_page", "capture_lead", "handoff_whatsapp"]);
    for (const t of TOOLS) {
      expect(t.strict).toBe(true);
      expect((t.input_schema as { additionalProperties?: boolean }).additionalProperties).toBe(false);
    }
  });

  it("offer exactly the page targets the Worker can resolve", () => {
    const schema = TOOLS[0].input_schema as { properties: { page: { enum: string[] } } };
    expect(schema.properties.page.enum).toEqual(Object.keys(PAGE_TARGETS));
  });
});

describe("encodeEvent", () => {
  it("writes one SSE event with single-line JSON data", () => {
    expect(encodeEvent({ event: "text", data: { delta: "a\nb" } })).toBe('event: text\ndata: {"delta":"a\\nb"}\n\n');
  });
});
