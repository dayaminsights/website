import { describe, expect, it } from "vitest";
import { SYSTEM } from "../src/prompt";

describe("SYSTEM", () => {
  it("is rules then knowledge, with the cache breakpoint on the knowledge", () => {
    expect(SYSTEM).toHaveLength(2);
    expect(SYSTEM[0].cache_control).toBeUndefined();
    expect(SYSTEM[1].cache_control).toEqual({ type: "ephemeral" });
  });

  it("stays byte-stable: no dates", () => {
    expect(SYSTEM.map((b) => b.text).join("\n")).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
  });

  it("carries the public facts and no price figures", () => {
    const k = SYSTEM[1].text;
    for (const fact of ["+91 78776 40693", "dayaminsights@gmail.com", "Udaipur", "UAE"]) expect(k).toContain(fact);
    expect(k).not.toMatch(/₹\s?\d|\$\s?\d|\b(rs|inr|aed|usd)\.?\s?\d|\d\s?(lakh|crore)/i);
  });

  it("is long enough to cache (Sonnet 5 minimum is 1,024 tokens)", () => {
    expect(SYSTEM.map((b) => b.text).join("").length).toBeGreaterThan(6000);
  });
});
