/**
 * Parses Ontario e-Laws HTML pages to extract section text.
 * Does NOT use cheerio — relies on structural patterns in ontario.ca/laws HTML.
 *
 * The e-Laws statute page structure (as of 2024):
 *   <div class="act-provision"> or <div class="section"> blocks
 *   Each section has an id like "s14", "s14s1", "s14s2", etc.
 *   Headings use <b> or <strong> with the section number.
 */

export type SectionResult =
  | { found: true; sectionId: string; text: string; url: string }
  | { found: false; reason: string; url: string };

/**
 * Fetch and parse a specific section from an Ontario e-Laws statute page.
 * actCode: e.g. "00e41" (Employment Standards Act, 2000)
 * section: e.g. "14", "14(2)", "14.1", "s. 14"
 */
export async function fetchOntarioSection(
  actCode: string,
  section: string
): Promise<SectionResult> {
  const normSec = normaliseSection(section);
  const baseUrl = `https://www.ontario.ca/laws/statute/${actCode}`;

  let html: string;
  try {
    const res = await fetch(baseUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LegalResearchVerifier/1.0; educational use)",
        Accept: "text/html",
      },
      // 10-second timeout
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return { found: false, reason: `HTTP ${res.status} from e-Laws`, url: baseUrl };
    }
    html = await res.text();
  } catch (err) {
    return {
      found: false,
      reason: `Network error: ${err instanceof Error ? err.message : String(err)}`,
      url: baseUrl,
    };
  }

  // Try to extract the section
  const extracted = extractSection(html, normSec);
  if (extracted) {
    return { found: true, sectionId: normSec, text: extracted, url: baseUrl };
  }

  // Fallback: return a window of text around the section number mention
  const fallback = fallbackExtract(html, normSec);
  if (fallback) {
    return { found: true, sectionId: normSec, text: fallback, url: baseUrl };
  }

  return {
    found: false,
    reason: `Section ${section} not found in the act page. The act was fetched but the section could not be located.`,
    url: baseUrl,
  };
}

/**
 * Normalise a section reference to a consistent form.
 * "s. 14(2)" → "14(2)", "section 14" → "14", "14.1(2)(a)" → "14.1(2)(a)"
 */
export function normaliseSection(raw: string): string {
  return raw
    .replace(/^(section|s\.?\s*)/i, "")
    .replace(/\s+/g, "")
    .trim();
}

// ── HTML extraction ──────────────────────────────────────────────────────────

/**
 * Extract the text of a section from e-Laws HTML.
 * Strategy:
 * 1. Look for id attributes: id="s14", id="s14s2", id="s14p2"
 * 2. Look for <b>14</b> or <strong>14</strong> at the start of a paragraph
 * 3. Take text until the next section starts
 */
function extractSection(html: string, section: string): string | null {
  // Build candidate id patterns for the section number
  // "14"      → s14
  // "14(2)"   → s14s2, s14p2
  // "14.1"    → s14p1, s14s1 (period → p or s)
  const ids = buildSectionIds(section);

  for (const id of ids) {
    const pattern = new RegExp(
      `id=["']${escapeRe(id)}["'][^>]*>([\\s\\S]*?)(?=id=["'][a-z]|<\\/body)`,
      "i"
    );
    const m = html.match(pattern);
    if (m) {
      return htmlToText(m[1]).trim();
    }
  }

  // Try anchor approach: find <a name="BK{n}"> followed by section heading
  // ontario.ca wraps sections in divs with sequential BK anchors
  // We look for "Section N" text nearby
  const anchorPattern = new RegExp(
    `(?:Section\\s+${escapeRe(section.replace(/\(\d+\).*$/, ""))})[^]*?(?=Section\\s+\\d|$)`,
    "i"
  );
  const am = html.match(anchorPattern);
  if (am) {
    const text = htmlToText(am[0]).trim();
    if (text.length > 20 && text.length < 8000) return text;
  }

  return null;
}

/**
 * Fallback: find text around the first mention of the section number in bold/heading context.
 */
function fallbackExtract(html: string, section: string): string | null {
  // e-Laws uses marginal notes like "Employment standards" before each section,
  // and section numbers appear as bold text
  const mainNum = section.replace(/[^0-9.]/g, "").split(".")[0];
  if (!mainNum) return null;

  // Pattern: bold/strong containing just the section number, then paragraph text
  const patterns = [
    // <b>14 </b> or <b>14</b> (maybe with subsection)
    new RegExp(
      `<(?:b|strong)[^>]*>\\s*${escapeRe(mainNum)}(?:\\s*\\(1\\))?\\s*<\\/(?:b|strong)>([\\s\\S]{50,2000}?)(?=<(?:b|strong)[^>]*>\\s*${escapeRe(String(Number(mainNum) + 1))}|$)`,
      "i"
    ),
    // "14." pattern (section number followed by period and text on same line)
    new RegExp(
      `>\\s*${escapeRe(mainNum)}\\.\\s*</[^>]+>([\\s\\S]{50,2000}?)(?=>\\s*${escapeRe(String(Number(mainNum) + 1))}\\.\\s*<)`,
      "i"
    ),
  ];

  for (const pat of patterns) {
    const m = html.match(pat);
    if (m) {
      const text = htmlToText(m[0]).trim();
      if (text.length > 30) return text.slice(0, 3000);
    }
  }

  return null;
}

function buildSectionIds(section: string): string[] {
  // "14"     → ["s14"]
  // "14(2)"  → ["s14s2", "s14p2"]
  // "14(2)(a)" → ["s14s2a", "s14p2a"]
  // "14.1"   → ["s14p1", "s14s1", "s14-1"]
  const ids: string[] = [];
  const norm = section.replace(/\s/g, "");

  // Simple numeric section
  if (/^\d+$/.test(norm)) {
    ids.push(`s${norm}`);
    return ids;
  }

  // Section with subsections in parens: 14(2)(a)
  const parts = norm.split(/[()]+/).filter(Boolean);
  if (parts.length >= 2) {
    let id = `s${parts[0]}`;
    ids.push(id);
    for (let i = 1; i < parts.length; i++) {
      id += `s${parts[i]}`;
      ids.push(id);
      ids.push(id.replace(/s([a-z])$/, "$1")); // variant without "s" prefix for letters
    }
  }

  // Section with decimal: 14.1
  if (norm.includes(".")) {
    const [main, sub] = norm.split(".");
    ids.push(`s${main}p${sub}`, `s${main}s${sub}`, `s${main}-${sub}`);
  }

  // Always add bare version
  ids.push(`s${norm.replace(/[^0-9a-z]/gi, "")}`);

  return [...new Set(ids)];
}

/** Very lightweight HTML → plain text (no dependency). */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "  • ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
