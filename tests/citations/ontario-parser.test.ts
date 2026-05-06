import { describe, it, expect } from "vitest";
import {
  normaliseSection,
  htmlToText,
  extractSectionFromText,
} from "@/lib/citations/ontario-parser";

// ── normaliseSection ──────────────────────────────────────────────────────────

describe("normaliseSection", () => {
  it("strips 'section' prefix", () => {
    expect(normaliseSection("section 14")).toBe("14");
  });

  it("strips 's.' shorthand", () => {
    expect(normaliseSection("s. 14")).toBe("14");
    expect(normaliseSection("s 14")).toBe("14");
    expect(normaliseSection("s.14")).toBe("14");
  });

  it("strips 'subsection'", () => {
    expect(normaliseSection("subsection 14(2)")).toBe("14(2)");
  });

  it("removes internal whitespace from subsection chains", () => {
    expect(normaliseSection("14 (2) (a)")).toBe("14(2)(a)");
  });

  it("is case-insensitive on the prefix", () => {
    expect(normaliseSection("SECTION 14")).toBe("14");
    expect(normaliseSection("Section 14")).toBe("14");
  });

  it("leaves a bare number unchanged", () => {
    expect(normaliseSection("116")).toBe("116");
  });
});

// ── htmlToText ────────────────────────────────────────────────────────────────

describe("htmlToText", () => {
  it("strips <script> blocks entirely", () => {
    const html = "<p>before</p><script>alert('x')</script><p>after</p>";
    const text = htmlToText(html);
    expect(text).not.toContain("alert");
    expect(text).toContain("before");
    expect(text).toContain("after");
  });

  it("strips <style> blocks entirely", () => {
    const html = "<style>p { color: red }</style><p>visible</p>";
    expect(htmlToText(html)).not.toContain("color: red");
    expect(htmlToText(html)).toContain("visible");
  });

  it("removes <nav>, <header>, <footer> blocks", () => {
    const html =
      "<nav>menu link</nav><header>banner text</header><p>main</p><footer>copyright</footer>";
    const text = htmlToText(html);
    expect(text).not.toContain("menu link");
    expect(text).not.toContain("banner text");
    expect(text).not.toContain("copyright");
    expect(text).toContain("main");
  });

  it("converts block-level elements to newlines", () => {
    const html = "<p>line one</p><p>line two</p>";
    const text = htmlToText(html);
    expect(text).toContain("line one");
    expect(text).toContain("line two");
    expect(text.split("\n").length).toBeGreaterThanOrEqual(2);
  });

  it("decodes common HTML entities", () => {
    const html = "<p>A &amp; B &mdash; C &nbsp;D &quot;E&quot;</p>";
    const text = htmlToText(html);
    expect(text).toContain("A & B");
    expect(text).toContain("—");
    expect(text).toContain('"E"');
  });

  it("removes all remaining tags", () => {
    const html = "<div><span class='x'>hello <b>world</b></span></div>";
    const text = htmlToText(html);
    expect(text).toContain("hello");
    expect(text).toContain("world");
    expect(text).not.toContain("<");
    expect(text).not.toContain(">");
  });

  it("collapses runs of spaces and excess blank lines", () => {
    const html = "<p>a    b</p>\n\n\n\n<p>c</p>";
    const text = htmlToText(html);
    expect(text).not.toMatch(/   /); // no run of 3+ spaces
    expect(text).not.toMatch(/\n{3,}/); // no 3+ consecutive newlines
  });
});

// ── extractSectionFromText ────────────────────────────────────────────────────

const ESA_FIXTURE = `Employment Standards Act, 2000

Part XV  RECORDS

Records of employer
14 (1) An employer shall make and keep records of every employee.
(2) Records shall be retained for three years after employment ends.
(3) Records may be kept in electronic form.

Inspection of records
15 An employee may inspect their own records during business hours.

Other obligations
16 Nothing in this Part limits other record-keeping obligations.

Notices
17 (1) Notices shall be given in writing.
`;

const HRC_FIXTURE = `Human Rights Code

Part I  FREEDOM FROM DISCRIMINATION

Services
1 Every person has a right to equal treatment with respect to services.

Accommodation
2 (1) Every person has a right to equal treatment with respect to accommodation.
(2) The right is subject to bona fide requirements.

Contracts
3 Every person has a right to equal treatment with respect to contracts.
`;

describe("extractSectionFromText", () => {
  it("extracts section 14 with all its subsections", () => {
    const result = extractSectionFromText(ESA_FIXTURE, "14");
    expect(result).not.toBeNull();
    expect(result).toContain("make and keep records");
    expect(result).toContain("Records shall be retained for three years");
    expect(result).toContain("electronic form");
  });

  it("does not bleed into section 15", () => {
    const result = extractSectionFromText(ESA_FIXTURE, "14");
    expect(result).not.toContain("inspect their own records");
  });

  it("extracts a section with no subsections (single line)", () => {
    const result = extractSectionFromText(ESA_FIXTURE, "15");
    expect(result).not.toBeNull();
    expect(result).toContain("inspect their own records");
    expect(result).not.toContain("Nothing in this Part");
  });

  it("extracts a section in the middle of the text (16)", () => {
    const result = extractSectionFromText(ESA_FIXTURE, "16");
    expect(result).not.toBeNull();
    expect(result).toContain("Nothing in this Part");
  });

  it("works for single-digit sections in a different fixture", () => {
    const result = extractSectionFromText(HRC_FIXTURE, "2");
    expect(result).not.toBeNull();
    expect(result).toContain("accommodation");
    expect(result).toContain("bona fide requirements");
    expect(result).not.toContain("right to equal treatment with respect to contracts");
  });

  it("handles section 1 at the start of the text", () => {
    const result = extractSectionFromText(HRC_FIXTURE, "1");
    expect(result).not.toBeNull();
    expect(result).toContain("services");
  });

  it("returns null when the section number is not present", () => {
    const result = extractSectionFromText(ESA_FIXTURE, "999");
    expect(result).toBeNull();
  });

  it("returns null for non-numeric input", () => {
    expect(extractSectionFromText(ESA_FIXTURE, "abc")).toBeNull();
    expect(extractSectionFromText(ESA_FIXTURE, "")).toBeNull();
  });

  it("documents the subsection-flattening behavior (14(2) → digits '142')", () => {
    // Known limitation: extractSectionFromText strips non-digit chars, which
    // joins parenthesised subsection numbers into the parent — "14(2)" becomes
    // the digit string "142", not "14". Callers should pass the parent section
    // number directly. This test pins the current behavior.
    expect(extractSectionFromText(ESA_FIXTURE, "14(2)")).toBeNull();
  });

  it("is bounded — does not return absurdly long output", () => {
    const result = extractSectionFromText(ESA_FIXTURE, "14");
    expect(result!.length).toBeLessThan(15000);
  });
});

// ── htmlToText + extractSectionFromText (integration with HTML fixture) ──────

describe("integration: HTML → plain text → section", () => {
  const HTML_FIXTURE = `
    <html>
    <head><title>Employment Standards Act</title></head>
    <body>
      <nav>Navigation links</nav>
      <header>Site banner</header>
      <main>
        <h2>Records of employer</h2>
        <p>14 (1) An employer shall make and keep records of every employee.</p>
        <p>(2) Records shall be retained for three years after employment ends.</p>
        <h2>Inspection of records</h2>
        <p>15 An employee may inspect their own records during business hours.</p>
      </main>
      <footer>Government of Ontario</footer>
      <script>console.log("tracking")</script>
    </body>
    </html>
  `;

  it("strips chrome and extracts section 14 end-to-end", () => {
    const plain = htmlToText(HTML_FIXTURE);
    expect(plain).not.toContain("Navigation links");
    expect(plain).not.toContain("Site banner");
    expect(plain).not.toContain("Government of Ontario");
    expect(plain).not.toContain("tracking");

    const result = extractSectionFromText(plain, "14");
    expect(result).not.toBeNull();
    expect(result).toContain("make and keep records");
    expect(result).toContain("three years");
    expect(result).not.toContain("inspect their own records");
  });
});
