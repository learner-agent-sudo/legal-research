/**
 * Fetches Hong Kong legislation from elegislation.gov.hk and extracts section text.
 *
 * The site is server-rendered (unlike Ontario's SPA) so plain HTML fetching works.
 * URL pattern: https://www.elegislation.gov.hk/hk/cap{N}/s{section}
 *
 * Section sub-parts (e.g. s.9(1)) are all contained on the parent section page (s9),
 * so we always fetch by the main section number and return the full section text.
 */

export type HkSectionResult =
  | { found: true;  sectionId: string; text: string; url: string }
  | { found: false; reason: string; url: string; debug?: { plainTextSample: string; htmlLength: number; plainTextLength: number } };

/**
 * cap: e.g. "57" (Employment Ordinance)
 * section: e.g. "9", "9(1)", "s. 9", "32A"
 */
export async function fetchHkSection(
  cap: string,
  section: string
): Promise<HkSectionResult> {
  const normSec = normaliseHkSection(section);
  const mainSec = normSec.replace(/\([^)]+\).*$/, ""); // strip subsection: "9(1)" → "9"
  const url = `https://www.elegislation.gov.hk/hk/cap${cap}/s${mainSec}`;

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-HK,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (res.status === 404) {
      return {
        found: false,
        reason: `Section ${normSec} was not found in Cap ${cap} (HTTP 404). Check the section number.`,
        url,
      };
    }
    if (!res.ok) {
      return {
        found: false,
        reason: `HTTP ${res.status} from elegislation.gov.hk. The site may be temporarily unavailable.`,
        url,
      };
    }
    html = await res.text();
  } catch (err) {
    return {
      found: false,
      reason: `Network error: ${err instanceof Error ? err.message : String(err)}`,
      url,
    };
  }

  if (html.length < 1000) {
    return {
      found: false,
      reason: "The page returned very little content — unexpected response from elegislation.gov.hk.",
      url,
    };
  }

  const plainText = hkHtmlToText(html);

  if (plainText.length < 100) {
    return {
      found: false,
      reason: "Could not extract plain text from the page — the site structure may have changed.",
      url,
      debug: {
        plainTextSample: plainText.slice(0, 500),
        htmlLength: html.length,
        plainTextLength: plainText.length,
      },
    };
  }

  // The section page for elegislation.gov.hk shows the section content directly.
  // We trim navigation boilerplate (which is typically at the top/bottom)
  // and return the substantive legislative text.
  const extracted = extractHkSectionText(plainText, mainSec);

  if (extracted) {
    return { found: true, sectionId: normSec, text: extracted, url };
  }

  return {
    found: false,
    reason: `Retrieved the page for Cap ${cap} s.${mainSec} but could not isolate the section text.`,
    url,
    debug: {
      plainTextSample: plainText.slice(0, 1500),
      htmlLength: html.length,
      plainTextLength: plainText.length,
    },
  };
}

/**
 * Normalise a section reference to a bare form.
 * "s. 9(1)"  → "9(1)"
 * "section 32A" → "32A"
 */
export function normaliseHkSection(raw: string): string {
  return raw
    .replace(/^(section|subsection|sub-section|s\.?\s*)/i, "")
    .replace(/\s+/g, "")
    .trim();
}

/**
 * Convert the elegislation.gov.hk HTML to plain text.
 * The site wraps legislative content in <div class="..."> blocks.
 * We strip navigation, header, footer, and scripts — same strategy as Ontario.
 */
export function hkHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    // Breadcrumb / toc divs that appear on every page
    .replace(/<div[^>]*class="[^"]*breadcrumb[^"]*"[^>]*>[\s\S]*?<\/div>/gi, " ")
    .replace(/<div[^>]*class="[^"]*toc[^"]*"[^>]*>[\s\S]*?<\/div>/gi, " ")
    // Block elements → newlines
    .replace(/<\/?(p|div|section|article|li|tr|h[1-6])[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(td|th)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    // Entities
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

/**
 * Extract the legislative text for a section from plain text of an elegislation page.
 *
 * elegislation.gov.hk serves one section per URL, so the page body IS the
 * section content after stripping navigation boilerplate.
 *
 * HK section heading patterns on the page:
 *   "9.  Wages\n9   An employer shall …"   (title line + body line)
 *   "9   An employer shall …"              (number + body on same line)
 *   "9A  Power to …"                       (alphanumeric section)
 *
 * Strategy:
 * 1. Try to find the section number followed directly by substantive content.
 * 2. If the first match is only a short title (< 30 chars), also capture the
 *    lines immediately following it.
 * 3. Fall back to stripping boilerplate and returning the whole cleaned body.
 */
export function extractHkSectionText(text: string, mainSec: string): string | null {
  const escapedSec = escapeRe(mainSec);

  // Find where the section heading starts (number at start of a line)
  const startPattern = new RegExp(
    `(?:^|\\n)([ \\t]*${escapedSec}[A-Z]?[ \\t]*[.\\t ].*)`,
    "m"
  );
  const startMatch = text.match(startPattern);

  if (startMatch && startMatch.index !== undefined) {
    const startIdx = startMatch.index + (startMatch[0].startsWith("\n") ? 1 : 0);

    // Find where the NEXT (different) section starts.
    // HK pages often repeat the section number on the body line ("10. Title\n10  Body"),
    // so we only stop at a number that differs from mainSec.
    const nextSecPattern = new RegExp(
      `\\n[ \\t]*(\\d+[A-Z]?)[ \\t]*[.\\t ]`,
      "gm"
    );
    nextSecPattern.lastIndex = startIdx + startMatch[1].length;
    let endIdx = text.length;
    let m: RegExpExecArray | null;
    while ((m = nextSecPattern.exec(text)) !== null) {
      if (m[1] !== mainSec) {
        endIdx = m.index;
        break;
      }
    }

    const result = text.slice(startIdx, endIdx).trim();
    if (result.length > 20 && result.length < 15000) {
      return result.slice(0, 8000);
    }
  }

  // Fallback: single-section page — strip boilerplate and return the body
  const boilerplatePatterns = [
    /^.*?elegislation\.gov\.hk.*?\n/gm,
    /^.*?government of hong kong.*?\n/gim,
    /^.*?laws of hong kong.*?\n/gim,
    /^.*?chapter\s+\d+.*?\n/gim,
    /^.*?back to top.*?\n/gim,
    /^.*?print this page.*?\n/gim,
    /^.*?previous\s*\|\s*next.*?\n/gim,
    /^.*?show.*?languages.*?\n/gim,
  ];

  let cleaned = text;
  for (const re of boilerplatePatterns) {
    cleaned = cleaned.replace(re, "\n");
  }
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  if (cleaned.length > 50 && cleaned.length < 15000) {
    return cleaned.slice(0, 8000);
  }

  return null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
