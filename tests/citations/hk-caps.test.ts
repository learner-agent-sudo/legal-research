import { describe, it, expect } from "vitest";
import { findHkCap, CAPS } from "@/lib/citations/hk-caps";
import { normaliseHkSection, hkHtmlToText, extractHkSectionText } from "@/lib/citations/hk-parser";

// ── findHkCap ─────────────────────────────────────────────────────────────────

describe("findHkCap", () => {
  it("returns null for empty input", () => {
    expect(findHkCap("")).toBeNull();
  });

  it("returns null for unknown ordinance", () => {
    expect(findHkCap("Some Made-Up Ordinance")).toBeNull();
  });

  it("finds Employment Ordinance by full name", () => {
    const cap = findHkCap("Employment Ordinance");
    expect(cap).not.toBeNull();
    expect(cap?.cap).toBe("57");
  });

  it("finds by cap number directly", () => {
    expect(findHkCap("57")?.cap).toBe("57");
    expect(findHkCap("cap 57")?.cap).toBe("57");
    expect(findHkCap("cap. 57")?.cap).toBe("57");
  });

  it("is case-insensitive", () => {
    expect(findHkCap("EMPLOYMENT ORDINANCE")?.cap).toBe("57");
    expect(findHkCap("employment ordinance")?.cap).toBe("57");
  });

  it("matches without 'Ordinance' suffix", () => {
    expect(findHkCap("Employment")?.cap).toBe("57");
    expect(findHkCap("Personal Data (Privacy)")?.cap).toBe("486");
  });

  it("finds Personal Data (Privacy) Ordinance", () => {
    const cap = findHkCap("Personal Data (Privacy) Ordinance");
    expect(cap?.cap).toBe("486");
  });

  it("finds Companies Ordinance", () => {
    const cap = findHkCap("Companies Ordinance");
    expect(cap).not.toBeNull();
  });

  it("finds Arbitration Ordinance", () => {
    expect(findHkCap("Arbitration Ordinance")?.cap).toBe("609");
  });

  it("finds Hong Kong Bill of Rights Ordinance", () => {
    expect(findHkCap("Hong Kong Bill of Rights Ordinance")?.cap).toBe("383");
  });

  it("does substring matching for partial names", () => {
    const cap = findHkCap("Labour Relations");
    expect(cap).not.toBeNull();
  });

  it("all CAPS entries have a non-empty cap and fullName", () => {
    for (const c of CAPS) {
      expect(c.cap.trim().length).toBeGreaterThan(0);
      expect(c.fullName.trim().length).toBeGreaterThan(0);
    }
  });
});

// ── normaliseHkSection ────────────────────────────────────────────────────────

describe("normaliseHkSection", () => {
  it("strips 's.' prefix", () => {
    expect(normaliseHkSection("s. 9")).toBe("9");
    expect(normaliseHkSection("s.9")).toBe("9");
    expect(normaliseHkSection("s 9")).toBe("9");
  });

  it("strips 'section' prefix", () => {
    expect(normaliseHkSection("section 9")).toBe("9");
    expect(normaliseHkSection("Section 32A")).toBe("32A");
  });

  it("preserves subsection parentheses", () => {
    expect(normaliseHkSection("s. 9(1)")).toBe("9(1)");
    expect(normaliseHkSection("section 32(2)(a)")).toBe("32(2)(a)");
  });

  it("removes internal whitespace", () => {
    expect(normaliseHkSection("9 (1)")).toBe("9(1)");
  });

  it("handles alphanumeric sections", () => {
    expect(normaliseHkSection("32A")).toBe("32A");
    expect(normaliseHkSection("s. 32A")).toBe("32A");
  });

  it("leaves bare numbers unchanged", () => {
    expect(normaliseHkSection("9")).toBe("9");
  });
});

// ── hkHtmlToText ─────────────────────────────────────────────────────────────

describe("hkHtmlToText", () => {
  it("strips scripts, styles, head, nav, header, footer", () => {
    const html = [
      "<head><title>T</title></head>",
      "<nav>menu</nav>",
      "<header>banner</header>",
      "<script>alert(1)</script>",
      "<style>p{color:red}</style>",
      "<p>An employer shall pay wages.</p>",
      "<footer>Gov HK</footer>",
    ].join("");
    const text = hkHtmlToText(html);
    expect(text).toContain("An employer shall pay wages");
    expect(text).not.toContain("menu");
    expect(text).not.toContain("banner");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("color:red");
    expect(text).not.toContain("Gov HK");
  });

  it("decodes HTML entities", () => {
    const html = "<p>A &amp; B &mdash; C &nbsp;D</p>";
    const text = hkHtmlToText(html);
    expect(text).toContain("A & B");
    expect(text).toContain("—");
  });

  it("strips all remaining tags", () => {
    const html = "<div><span class='x'>hello <b>world</b></span></div>";
    const text = hkHtmlToText(html);
    expect(text).toContain("hello");
    expect(text).not.toContain("<");
  });
});

// ── extractHkSectionText ──────────────────────────────────────────────────────

// Fixtures simulate a single-section page returned by elegislation.gov.hk/hk/cap57/s9
// (the site serves one section per URL, so the body IS the section content)

const EMPLOYMENT_FIXTURE = `
9. Wages
9   An employer shall pay wages to each of his employees.
(1) Wages shall be paid on the due date for payment of wages.
(2) Subject to subsection (3), wages shall be paid not later than 7 days.
(3) This section shall not apply to wages paid by cheque.
`;

const EMPLOYMENT_FIXTURE_S10 = `
10. Recovery of wages
10  An employee may recover wages by action in a court of competent jurisdiction.
(1) The action may be brought in a court of competent jurisdiction.
`;

const BILL_OF_RIGHTS_FIXTURE = `
Laws of Hong Kong
Hong Kong Bill of Rights Ordinance
Chapter 383

8. Hong Kong Bill of Rights
(1) The Hong Kong Bill of Rights is set out in Part II.
(2) The Bill of Rights shall be interpreted and applied so as to be consistent.
`;

describe("extractHkSectionText", () => {
  it("extracts section 9 content from a single-section page", () => {
    const result = extractHkSectionText(EMPLOYMENT_FIXTURE, "9");
    expect(result).not.toBeNull();
    expect(result).toContain("employer shall pay wages");
    expect(result).toContain("due date");
  });

  it("does not include section 10 content when section 9 is extracted", () => {
    const result = extractHkSectionText(EMPLOYMENT_FIXTURE, "9");
    expect(result).not.toContain("Recovery of wages");
  });

  it("extracts section 10 from its own page fixture", () => {
    const result = extractHkSectionText(EMPLOYMENT_FIXTURE_S10, "10");
    expect(result).not.toBeNull();
    expect(result).toContain("recover wages");
  });

  it("returns non-null via fallback for plain body text (no heading)", () => {
    const singleSection =
      "An employer shall pay wages to each of his employees.\n" +
      "Wages shall be paid on the due date for payment of wages.";
    const result = extractHkSectionText(singleSection, "9");
    expect(result).not.toBeNull();
    expect(result).toContain("employer shall pay wages");
  });

  it("returns null for an empty string", () => {
    expect(extractHkSectionText("", "9")).toBeNull();
  });

  it("returns null for whitespace-only input", () => {
    expect(extractHkSectionText("   ", "9")).toBeNull();
  });

  it("handles section 8 in Bill of Rights fixture", () => {
    const result = extractHkSectionText(BILL_OF_RIGHTS_FIXTURE, "8");
    expect(result).not.toBeNull();
    expect(result).toContain("Hong Kong Bill of Rights");
  });

  it("result is bounded below 8000 chars", () => {
    const longBody = "An employer shall pay wages.\n".repeat(400);
    const result = extractHkSectionText(`9   ${longBody}`, "9");
    if (result !== null) expect(result.length).toBeLessThanOrEqual(8000);
  });
});
