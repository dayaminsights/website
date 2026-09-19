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
      "or when they ask where to read more. The card is the link: do not also paste a URL in your reply. " +
      "Your turn ends at the card, so if the visitor has described a need of their own and has not given their details yet, " +
      "the message you write before this call must end by asking whether the team should get in touch, and for their name and a phone or WhatsApp number.",
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
          description: "Leave this out unless the visitor named a day or time for a call. Then: that day and time, with their timezone if known.",
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

const REQUIRED_TEXT = ["name", "phone", "need_summary"];
const OPTIONAL_TEXT = ["business", "city", "preferred_time"];

/** The model occasionally leaks markup into a free-text field (seen in evals); none of it belongs in an email. */
export function cleanLead(input: Record<string, unknown>): Lead {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof v !== "string") {
      if (!(Array.isArray(v) && v.length === 0)) out[k] = v;
      continue;
    }
    const t = v.trim();
    if (OPTIONAL_TEXT.includes(k)) {
      if (t && !/[<>]/.test(t)) out[k] = t;
    } else {
      out[k] = REQUIRED_TEXT.includes(k) ? t.replace(/[<>]/g, "").replace(/\s{2,}/g, " ").trim() : t;
    }
  }
  return out as unknown as Lead;
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
      return result(block.id, "The card is on the visitor's screen, under your message.");
    }
    case "capture_lead":
      emit({ event: "lead", data: cleanLead(input) });
      return result(block.id, "Sent to the team; they reply within one working day.");
    case "handoff_whatsapp":
      emit({ event: "card", data: { kind: "whatsapp", summary: String(input.summary ?? "") } });
      return result(block.id, "The WhatsApp button is on the visitor's screen, under your message.");
    default:
      return result(block.id, `Unknown tool "${block.name}".`, true);
  }
}
