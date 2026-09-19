export const MODEL = "claude-sonnet-5";
export const MAX_TOKENS = 2048;
/** Tool rounds per visitor message. The call after the last round runs with tools off. */
export const MAX_TOOL_ROUNDS = 3;

export const MAX_INPUT_CHARS = 1000;
export const MAX_VISITOR_MESSAGES = 40;
export const MAX_HISTORY_MESSAGES = 200;
export const MAX_BODY_CHARS = 200_000;
export const MAX_META_CHARS = 200;
/** Lead sheet: each field of a contact-form copy, and the whole copy. */
export const MAX_FIELD_CHARS = 2000;
export const MAX_LEAD_CHARS = 20_000;

export const ALLOWED_ORIGINS = [
  "https://dayaminsights.com",
  "https://www.dayaminsights.com",
  "http://localhost:8090",
  "http://127.0.0.1:8090",
];

/** The nine pages the widget runs on. The Worker reports anything else as "/". */
export const PAGES = [
  "/index.html",
  "/dashboards.html",
  "/automation.html",
  "/ai-chatbot.html",
  "/websites.html",
  "/how-we-work.html",
  "/faq.html",
  "/privacy.html",
  "/404.html",
];

export interface Env {
  ANTHROPIC_API_KEY: string;
  HISTORY_SECRET: string;
  /** The Apps Script web app that appends rows to the lead sheet; unset = no Sheet writes. */
  SHEET_URL?: string;
  SHEET_TOKEN?: string;
  RATE_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

/** The part of the Workers ExecutionContext we use. */
export interface Ctx {
  waitUntil(promise: Promise<unknown>): void;
}
