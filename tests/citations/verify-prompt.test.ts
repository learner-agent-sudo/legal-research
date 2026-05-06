import { describe, it, expect } from "vitest";
import { buildCitationVerifyPrompt, parseVerdict } from "@/lib/citations/verify-prompt";

describe("parseVerdict", () => {
  it("parses [ACCURATE] tag", () => {
    expect(parseVerdict("[ACCURATE]\n\nThe section matches.")).toBe("accurate");
  });

  it("parses [PARTIAL] tag", () => {
    expect(parseVerdict("[PARTIAL]\n\nMostly right but missing nuance.")).toBe("partial");
  });

  it("parses [WRONG] tag", () => {
    expect(parseVerdict("[WRONG]\n\nThe claim contradicts the section.")).toBe("wrong");
  });

  it("parses [UNVERIFIABLE] tag", () => {
    expect(parseVerdict("[UNVERIFIABLE]\n\nNot enough text.")).toBe("unverifiable");
  });

  it("defaults to unverifiable when no tag is present", () => {
    expect(parseVerdict("This response has no tag.")).toBe("unverifiable");
  });

  it("handles leading whitespace before tag", () => {
    expect(parseVerdict("\n\n   [ACCURATE]\n\nbody")).toBe("accurate");
  });

  it("is case-insensitive", () => {
    expect(parseVerdict("[accurate]\n\nbody")).toBe("accurate");
  });

  it("only looks at the first line", () => {
    // [WRONG] in body should be ignored if first line says [ACCURATE]
    expect(parseVerdict("[ACCURATE]\n\nThe word [WRONG] appears in body.")).toBe("accurate");
  });
});

describe("buildCitationVerifyPrompt", () => {
  const baseArgs = {
    jurisdiction: "Ontario, Canada",
    act: "Employment Standards Act, 2000",
    section: "14(2)",
    sectionText: "Records shall be retained for three years after employment ends.",
    sourceUrl: "https://www.ontario.ca/laws/statute/00e41",
    claudeClaim: "Section 14(2) requires three-year retention.",
  };

  it("includes all four verdict tags in the instructions", () => {
    const prompt = buildCitationVerifyPrompt(baseArgs);
    expect(prompt).toContain("[ACCURATE]");
    expect(prompt).toContain("[PARTIAL]");
    expect(prompt).toContain("[WRONG]");
    expect(prompt).toContain("[UNVERIFIABLE]");
  });

  it("includes the act, section, jurisdiction, and source URL", () => {
    const prompt = buildCitationVerifyPrompt(baseArgs);
    expect(prompt).toContain("Employment Standards Act, 2000");
    expect(prompt).toContain("14(2)");
    expect(prompt).toContain("Ontario, Canada");
    expect(prompt).toContain("https://www.ontario.ca/laws/statute/00e41");
  });

  it("includes both Claude's claim and the actual section text", () => {
    const prompt = buildCitationVerifyPrompt(baseArgs);
    expect(prompt).toContain("Section 14(2) requires three-year retention.");
    expect(prompt).toContain("Records shall be retained for three years");
  });

  it("truncates very long section text to ~6000 chars", () => {
    const longText = "x".repeat(20000);
    const prompt = buildCitationVerifyPrompt({ ...baseArgs, sectionText: longText });
    // The full section text (20000 chars) should not appear; only ~6000 should
    expect(prompt).not.toContain("x".repeat(7000));
    expect(prompt).toContain("x".repeat(5000));
  });
});
