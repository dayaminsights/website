import type Anthropic from "@anthropic-ai/sdk";
import type { Emit, Lead } from "./events";

/** Where each page card goes: the section of that page that shows what we build. */
export const PAGE_TARGETS: Record<string, string> = {
  dashboards: "/dashboards.html#questions",
  automation: "/automation.html#work-that",
  ai_assistants: "/automation.html#ai",
  chatbot: "/ai-chatbot.html#what",
  websites: "/websites.html#jobs",
  how_we_work: "/how-we-work.html#ladder",
  faq: "/faq.html",
  services: "/index.html#value",
};

const SERVICES = ["dashboards", "automation", "chatbot", "website"];

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "suggest_page",
    description:
      "Show the visitor a card that links to the page for their use case. Use it once you know which service fits them, " +
      "or when they ask where to read more. The card is the link: do not also paste a URL in your reply.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        page: {
          type: "string",
          enum: Object.keys(PAGE_TARGETS),
          description:
            "dashboards; automation (workflow automation); ai_assistants (AI for their own team); chatbot (website and WhatsApp chatbot); " +
            "websites; how_we_work; faq; services (an overview of everything).",
        },
        reason: { type: "string", description: "One short line for the card, in the visitor's language, saying why this page fits them." },
      },
      required: ["page", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "capture_lead",
    description:
      "Send the visitor's details and your classification to the Dayam Insights team, who reply within one working day. " +
      "Call it once you have a name and a phone or WhatsApp number and understand the need. " +
      "Call it again only if something important changes, such as a preferred call time.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        phone: { type: "string", description: "Phone or WhatsApp number exactly as the visitor gave it." },
        business: { type: "string" },
        city: { type: "string" },
        need_summary: {
          type: "string",
          description: "Two or three plain sentences: the business, what is going wrong, and where their information lives today.",
        },
        service: { type: "string", enum: [...SERVICES, "unclear"], description: "The main need." },
        also: { type: "array", items: { type: "string", enum: SERVICES }, description: "Other services that came up." },
        readiness: {
          type: "string",
          enum: ["ready_to_talk", "exploring", "not_a_fit"],
          description:
            "ready_to_talk: wants to start, or asked to be contacted. exploring: has the problem, still looking. " +
            "not_a_fit: a student, job seeker, someone selling to us, or something we do not build.",
        },
        sector: { type: "string", enum: ["retail", "manufacturing", "distribution", "clinic", "services", "other"] },
        country: { type: "string", enum: ["india", "uae", "other"] },
        preferred_time: {
          type: "string",
          description: "Only if they asked for a call: the day and time they prefer, with their timezone if known.",
        },
      },
      required: ["name", "phone", "need_summary", "service", "readiness", "sector", "country"],
      additionalProperties: false,
    },
  },
  {
    name: "handoff_whatsapp",
    description:
      "Show a button that opens WhatsApp with the Dayam Insights team, with a message prefilled. Use it when the visitor wants a person now, " +
      "or asks for something only a person can agree: a price, a discount, payment or credit terms, a promised date.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "One or two sentences the visitor would send, written as them, in their language." },
      },
      required: ["summary"],
      additionalProperties: false,
    },
  },
];

function result(id: string, content: string, isError = false): Anthropic.ToolResultBlockParam {
  return { type: "tool_result", tool_use_id: id, content, ...(isError ? { is_error: true } : {}) };
}

/** Every tool is a message to the widget; the model only needs to know it landed. */
export function runTool(block: Anthropic.ToolUseBlock, emit: Emit): Anthropic.ToolResultBlockParam {
  const input = (block.input ?? {}) as Record<string, unknown>;
  switch (block.name) {
    case "suggest_page": {
      const page = String(input.page ?? "");
      const href = PAGE_TARGETS[page];
      if (!href) return result(block.id, `Unknown page "${page}".`, true);
      emit({ event: "card", data: { kind: "page", page, href, reason: String(input.reason ?? "") } });
      return result(block.id, "The card is on the visitor's screen.");
    }
    case "capture_lead":
      emit({ event: "lead", data: input as unknown as Lead });
      return result(block.id, "Sent to the team. They reply within one working day.");
    case "handoff_whatsapp":
      emit({ event: "card", data: { kind: "whatsapp", summary: String(input.summary ?? "") } });
      return result(block.id, "The WhatsApp button is on the visitor's screen.");
    default:
      return result(block.id, `Unknown tool "${block.name}".`, true);
  }
}
