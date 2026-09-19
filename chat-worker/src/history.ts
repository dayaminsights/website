import type Anthropic from "@anthropic-ai/sdk";

const enc = new TextEncoder();

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array | null {
  if (!/^[0-9a-f]{64}$/.test(hex)) return null;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** HMAC-SHA256 over the JSON of the whole history, hex-encoded. */
export async function signHistory(history: Anthropic.MessageParam[], secret: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(JSON.stringify(history)));
  return toHex(sig);
}

/** An empty history needs no signature; anything else must carry the one we issued. */
export async function verifyHistory(
  history: Anthropic.MessageParam[],
  sig: string | undefined,
  secret: string,
): Promise<boolean> {
  if (history.length === 0) return true;
  const bytes = sig ? fromHex(sig) : null;
  if (!bytes) return false;
  return crypto.subtle.verify("HMAC", await hmacKey(secret), bytes, enc.encode(JSON.stringify(history)));
}

/** Visitor messages are the user turns that carry text. Tool results are user turns too, but not the visitor's. */
export function countVisitorTurns(history: Anthropic.MessageParam[]): number {
  return history.filter(
    (m) => m.role === "user" && Array.isArray(m.content) && m.content.some((b) => b.type === "text"),
  ).length;
}
