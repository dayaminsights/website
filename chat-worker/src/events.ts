import type Anthropic from "@anthropic-ai/sdk";

export type ErrorCode =
  | "bad_request"
  | "forbidden"
  | "rate_limited"
  | "limit_reached"
  | "too_long"
  | "reset"
  | "unavailable"
  | "refused";

export type Service = "dashboards" | "automation" | "chatbot" | "website";

export interface Lead {
  name: string;
  phone: string;
  business?: string;
  city?: string;
  need_summary: string;
  service: Service | "unclear";
  also?: Service[];
  readiness: "ready_to_talk" | "exploring" | "not_a_fit";
  sector: "retail" | "manufacturing" | "distribution" | "clinic" | "services" | "other";
  country: "india" | "uae" | "other";
  preferred_time?: string;
}

export type Card =
  | { kind: "page"; page: string; href: string; reason: string }
  | { kind: "whatsapp"; summary: string };

export type ChatEvent =
  | { event: "text"; data: { delta: string } }
  | { event: "card"; data: Card }
  | { event: "lead"; data: Lead }
  | { event: "done"; data: { append: Anthropic.MessageParam[]; sig: string } }
  | { event: "error"; data: { code: ErrorCode } };

export type Emit = (e: ChatEvent) => void;

/** One server-sent event. JSON.stringify never emits a raw newline, so data is always one line. */
export function encodeEvent(e: ChatEvent): string {
  return `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`;
}
