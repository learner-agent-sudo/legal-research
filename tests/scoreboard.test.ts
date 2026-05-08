import { describe, it, expect } from "vitest";
import { extractExcerpt, cardAnchorId } from "@/lib/scoreboard-utils";

describe("extractExcerpt", () => {
  it("returns empty string for empty input", () => {
    expect(extractExcerpt("")).toBe("");
  });

  it("skips blank lines and returns first substantive sentence", () => {
    const body = "\n\nThe answer contains an error regarding section 14.\nMore detail here.";
    const result = extractExcerpt(body);
    expect(result).toContain("section 14");
  });

  it("skips markdown headings", () => {
    const body = "## Overall Assessment\nThe answer is mostly correct.";
    expect(extractExcerpt(body)).toContain("mostly correct");
    expect(extractExcerpt(body)).not.toContain("##");
  });

  it("strips leading list markers", () => {
    const body = "- The cited statute number is wrong.";
    expect(extractExcerpt(body)).not.toMatch(/^-/);
    expect(extractExcerpt(body)).toContain("statute number");
  });

  it("strips bold labels like **Overall:**", () => {
    const body = "**Overall:** The answer disagrees with the statute.";
    const result = extractExcerpt(body);
    expect(result).not.toContain("**");
    expect(result).toContain("disagrees");
  });

  it("truncates at sentence boundary within 240 chars", () => {
    const long = "The answer is wrong because it cites section 14 when in fact the correct section is 15 and this makes the whole argument invalid because the statute clearly distinguishes between the two. More text follows here.";
    const result = extractExcerpt(long);
    expect(result.length).toBeLessThanOrEqual(245); // 240 + ellipsis
    expect(result).toMatch(/[.!?…]$/);
  });

  it("truncates to 240 chars when no sentence boundary found", () => {
    const noStop = "a".repeat(300);
    const result = extractExcerpt(noStop);
    expect(result.length).toBeLessThanOrEqual(243); // 240 + "…"
  });

  it("skips lines shorter than 20 chars", () => {
    const body = "OK.\nThe answer is wrong on the statute citation.";
    expect(extractExcerpt(body)).toContain("wrong on the statute");
  });

  it("skips horizontal rules", () => {
    const body = "---\nThe answer has a major error.";
    expect(extractExcerpt(body)).toContain("major error");
  });
});

describe("cardAnchorId", () => {
  it("prepends result-", () => {
    expect(cardAnchorId("groq-llama")).toMatch(/^result-/);
  });

  it("replaces special characters with dashes", () => {
    expect(cardAnchorId("model.name/v2")).toBe("result-model-name-v2");
  });

  it("preserves alphanumeric and hyphens", () => {
    expect(cardAnchorId("groq-llama-70b")).toBe("result-groq-llama-70b");
  });
});
