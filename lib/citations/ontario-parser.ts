/**
 * Fetches Ontario legislation from e-Laws and extracts section text.
 *
 * Strategy: strip all HTML to plain text first, then find section numbers
 * in the plain text. This is resilient to HTML structural changes and avoids
 * the brittleness of tag-based parsing.
 */

export type SectionResult =
  | { found: true; sectionId: string; text: string; url: string }
  | { found: false; reason: string; url: string };

/**
 * Fetch and extract a specific section from an Ontario e-Laws statute page.
 * actCode: e.g. "00e41" (Employment Standards Act, 2000)
 * section: e.g. "14", "14(2)", "116", "s. 116"
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
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-CA,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      return {
        found: false,
        reason: `HTTP ${res.status} when fetching from e-Laws. The site may be temporarily unavailable.`,
        url: baseUrl,
      };
    }
    html = await res.text();
  } catch (err) {
    return {
      found: false,
      reason: `Network error: ${err instanceof Error ? err.message : String(err)}`,
      url: baseUrl,
    };
  }

  // Sanity check — if the page is very small it's probably a shell / error page
  if (html.length < 5000) {
    return {
      found: false,
      reason: "The e-Laws page returned very little content — it may be JavaScript-rendered or unavailable server-side.",
      url: baseUrl,
    };
  }

  // Convert HTML to plain text, then extract the section
  const plainText = htmlToText(html);
  const extracted = extractSectionFromText(plainText, normSec);

  if (extracted) {
    return { found: true, sectionId: normSec, text: extracted, url: baseUrl };
  }

  return {
    found: false,
    reason: `Section ${section} could not be located in the act text. The act page was retrieved (${Math.round(html.length / 1024)} KB) but section ${normSec} was not found. Check the section number or try viewing the act directly.`,
    url: baseUrl,
  };
}

/**
 * Normalise a section reference to a consistent bare form.
 * "s. 14(2)" → "14(2)", "section 116" → "116", "s 14" → "14"
 */
export function normaliseSection(raw: string): string {
  return raw
    .replace(/^(section|subsection|sub-section|s\.?\s*)/i, "")
    .replace(/\s+/g, "")
    .trim();
}

// ── Plain-text section extraction ─────────────────────────────────────────

/**
 * Extract a section from the plain text of a statute.
 *
 * Ontario legislation plain text (after HTML stripping) looks like:
 *
 *   ...marginal note...
 *   116 (1) First subsection text here.
 *   (2) Second subsection text.
 *   ...
 *   117 Next section starts here.
 *
 * We look for the section number at the start of a "paragraph unit"
 * (after a newline, optional whitespace), optionally followed by (N).
 * We capture until the next section number at the same level.
 */
function extractSectionFromText(text: string, section: string): string | null {
  // Get the bare number (e.g. "116" from "116(2)")
  const mainNum = section.replace(/[^0-9.]/g, "");
  if (!mainNum) return null;

  const nextNum = getNextSectionNum(mainNum);

  // Pattern: section number at start of a line (with optional leading whitespace)
  // Followed by optional subsection "(N)" and then content
  // Stops at the next section number at the same level
  const sectionPattern = new RegExp(
    `(?:^|\\n)[ \\t]*${escapeRe(mainNum)}[ \\t]*(?:\\([^)]+\\))?[ \\t](.+?)` +
    `(?=\\n[ \\t]*${escapeRe(nextNum)}[ \\t]*(?:\\([^)]+\\))?[ \\t]|$)`,
    "s" // dotAll — . matches newlines
  );

  const m = text.match(sectionPattern);
  if (m) {
    const result = (`${mainNum} ` + m[1]).trim();
    if (result.length > 20 && result.length < 15000) {
      return result.slice(0, 8000);
    }
  }

  // Fallback: looser match — find the number on its own line, grab the next N lines
  const loosePattern = new RegExp(
    `(?:^|\\n)[ \\t]*${escapeRe(mainNum)}[ \\t]*(?:\\n|[ \\t].{1,2000})`,
    "m"
  );
  const lm = text.match(loosePattern);
  if (lm) {
    // Get 60 lines starting from this match
    const startIdx = text.indexOf(lm[0]);
    const chunk = text.slice(startIdx, startIdx + 6000);
    const lines = chunk.split("\n");

    // Find where next section starts within those lines
    const nextSectionRe = new RegExp(`^[ \\t]*${escapeRe(nextNum)}[ \\t]`);
    const endLineIdx = lines.findIndex((l, i) => i > 0 && nextSectionRe.test(l));
    const relevant = endLineIdx > 0 ? lines.slice(0, endLineIdx) : lines.slice(0, 60);

    const result = relevant.join("\n").trim();
    if (result.length > 20) return result.slice(0, 8000);
  }

  return null;
}

/** For section "116", the next section is "117". For "14.1" it's "14.2". */
function getNextSectionNum(num: string): string {
  if (num.includes(".")) {
    const [main, sub] = num.split(".");
    return `${main}.${Number(sub) + 1}`;
  }
  return String(Number(num) + 1);
}

// ── HTML → plain text ─────────────────────────────────────────────────────

function htmlToText(html: string): string {
  return html
    // Remove scripts and styles entirely
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    // Block-level elements → newlines
    .replace(/<\/?(p|div|section|article|li|tr|h[1-6])[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(td|th)[^>]*>/gi, " ")
    // Remove all remaining tags
    .replace(/<[^>]+>/g, "")
    // Decode entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&#\d+;/g, " ")
    // Normalise whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
