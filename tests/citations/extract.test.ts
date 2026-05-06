import { describe, it, expect } from "vitest";
import { extractCitations } from "@/lib/citations/extract";

describe("extractCitations", () => {
  it("returns [] for empty / very short input", () => {
    expect(extractCitations("")).toEqual([]);
    expect(extractCitations("hi")).toEqual([]);
  });

  it("finds 'section X of [the] Y Act' (Pattern A)", () => {
    const text = "Section 14(2) of the Employment Standards Act, 2000 requires record-keeping.";
    const result = extractCitations(text);
    expect(result).toHaveLength(1);
    expect(result[0].section).toBe("14(2)");
    expect(result[0].act).toMatch(/Employment Standards Act, 2000/);
    expect(result[0].jurisdiction).toBe("ontario");
  });

  it("finds 's. X' shorthand", () => {
    const text = "Pursuant to s. 96(1) of the Labour Relations Act, 1995, complaints must be filed.";
    const result = extractCitations(text);
    expect(result).toHaveLength(1);
    expect(result[0].section).toBe("96(1)");
    expect(result[0].act).toMatch(/Labour Relations Act/);
  });

  it("finds Y Act first, then nearby section (Pattern B)", () => {
    const text = "Under the Limitations Act, 2002, section 4 sets the basic period.";
    const result = extractCitations(text);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const cite = result.find((c) => /Limitations Act/.test(c.act));
    expect(cite).toBeTruthy();
    expect(cite?.section).toBe("4");
  });

  it("deduplicates the same act/section even when both patterns match", () => {
    const text =
      "Under section 14(2) of the Employment Standards Act, 2000 the rules apply. " +
      "The Employment Standards Act, 2000 also says section 14(2) elsewhere.";
    const result = extractCitations(text);
    const matching = result.filter(
      (c) => c.section === "14(2)" && /Employment Standards Act/.test(c.act)
    );
    expect(matching).toHaveLength(1);
  });

  it("includes context window around the match", () => {
    const text =
      "Some preamble text here before the citation. Section 14(2) of the Employment Standards Act, 2000 governs records. Followed by more text.";
    const result = extractCitations(text);
    expect(result[0].context.length).toBeGreaterThan(20);
    expect(result[0].context).toMatch(/Section 14\(2\)/);
  });

  it("returns multiple distinct citations", () => {
    const text =
      "Under section 14 of the Employment Standards Act, 2000 and also section 96 of the Labour Relations Act, 1995, the rules differ.";
    const result = extractCitations(text);
    expect(result.length).toBeGreaterThanOrEqual(2);
    const sections = result.map((c) => c.section).sort();
    expect(sections).toContain("14");
    expect(sections).toContain("96");
  });

  it("captures subsection chains like 14(2)(a)", () => {
    const text = "See section 14(2)(a) of the Employment Standards Act, 2000.";
    const result = extractCitations(text);
    expect(result[0].section).toBe("14(2)(a)");
  });

  it("returns [] when text has no act-shaped citations", () => {
    const text = "This is a plain English paragraph with no legal citations whatsoever.";
    expect(extractCitations(text)).toEqual([]);
  });
});
