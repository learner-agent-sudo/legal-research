/**
 * Extracts legislation citations from free-text legal answers.
 *
 * Regex-first approach: handles the common patterns lawyers actually write.
 * Returns structured citations that can be passed to /api/lookup-legislation.
 *
 * Patterns covered:
 *   "section 14(2) of the Employment Standards Act, 2000"
 *   "s. 14(2)"  (when the act was named earlier)
 *   "ss. 14-16 of the X Act"
 *   "subsection 14(2)"
 *   "s 14"
 */

export type ExtractedCitation = {
  jurisdiction: "ontario" | "unknown";
  act: string;          // act name as it appears in the text
  section: string;      // normalised section reference, e.g. "14(2)"
  rawMatch: string;     // the raw text that matched
  context: string;      // ~200 chars around the match for "what Claude said"
};

// Section pattern: "s. 14", "section 14", "subsection 14(2)", "s 14(2)(a)"
// Captures the section number including subsections in parens
const SECTION_RE =
  /\b(?:sub)?section\s+(\d+(?:\.\d+)?(?:\s*\([^)]+\))*)\b|\bs(?:s)?\.\s*(\d+(?:\.\d+)?(?:\s*\([^)]+\))*)\b|\bs\s+(\d+(?:\.\d+)?(?:\s*\([^)]+\))*)\b/gi;

// Act name pattern: capitalised words ending in "Act" optionally followed by ", YYYY"
// Tightened to avoid grabbing whole sentences: max 6 capitalised words before "Act"
const ACT_RE =
  /\b((?:[A-Z][a-z'-]+(?:\s+(?:and|of|the|for|on|to))?\s+){1,6}Act(?:,\s*\d{4})?)\b/g;

/**
 * Extract citations of the form "section X of [the] Y Act"
 * (the strongest pattern — both section and act in one phrase)
 */
export function extractCitations(text: string): ExtractedCitation[] {
  if (!text || text.length < 4) return [];

  const found: ExtractedCitation[] = [];
  const seen = new Set<string>();

  // Pattern A: "section X of [the] Y Act" — section comes first
  const patternA =
    /\b(?:(?:sub)?section|s\.?|ss\.?)\s+(\d+(?:\.\d+)?(?:\s*\([^)]+\))*)\s+of\s+(?:the\s+)?((?:[A-Z][A-Za-z'-]*(?:\s+(?:and|of|the|for|on|to))?\s+){1,6}Act(?:,\s*\d{4})?)/gi;

  for (const m of text.matchAll(patternA)) {
    const section = normaliseSection(m[1]);
    const act = m[2].trim();
    const key = `${act.toLowerCase()}|${section}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({
      jurisdiction: "ontario", // Ontario-default for now; refined later
      act,
      section,
      rawMatch: m[0],
      context: extractContext(text, m.index ?? 0, m[0].length),
    });
  }

  // Pattern B: "Y Act ... section X" — act first, section nearby (≤120 chars)
  // Useful when Claude writes "Under the X Act, section 14(2) provides ..."
  for (const am of text.matchAll(ACT_RE)) {
    const actName = am[1].trim();
    const actIdx = am.index ?? 0;
    const windowText = text.slice(actIdx, actIdx + 200);
    // Find first section ref in this window
    SECTION_RE.lastIndex = 0;
    const sm = SECTION_RE.exec(windowText);
    if (!sm) continue;
    const sectionRaw = sm[1] || sm[2] || sm[3];
    if (!sectionRaw) continue;
    const section = normaliseSection(sectionRaw);
    const key = `${actName.toLowerCase()}|${section}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({
      jurisdiction: "ontario",
      act: actName,
      section,
      rawMatch: `${actName} … ${sm[0]}`,
      context: extractContext(text, actIdx, sm.index! + sm[0].length),
    });
  }

  return found;
}

function normaliseSection(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

function extractContext(text: string, start: number, length: number): string {
  const ctxStart = Math.max(0, start - 80);
  const ctxEnd = Math.min(text.length, start + length + 80);
  let ctx = text.slice(ctxStart, ctxEnd).replace(/\s+/g, " ").trim();
  if (ctxStart > 0) ctx = "…" + ctx;
  if (ctxEnd < text.length) ctx = ctx + "…";
  return ctx;
}

// ── Case-law citations ──────────────────────────────────────────────────────

export type ExtractedCaseCitation = {
  caseName: string;     // "Smith v Jones"
  citation: string;     // "[2019] ONCA 123" or "" if not detected
  rawMatch: string;
  context: string;
};

/**
 * Extract case-law citations: "Plaintiff v Defendant" plus an optional citation
 * block in the next ~100 chars.
 *
 * Detected citation forms:
 *   [2019] ONCA 123          (year-bracketed neutral)
 *   2019 ONCA 123            (year-first neutral)
 *   (2019), 50 OR (3d) 1     (parallel)
 *   [1932] AC 562            (UK / older)
 */
export function extractCaseCitations(text: string): ExtractedCaseCitation[] {
  if (!text || text.length < 4) return [];

  const found: ExtractedCaseCitation[] = [];
  const seen = new Set<string>();

  // "X v Y" — capitalised word(s) on each side, allow common connectors
  const nameRe =
    /\b([A-Z][\w.'-]+(?:\s+(?:[A-Z][\w.'-]+|of|the|and))*)\s+v\.?\s+([A-Z][\w.'-]+(?:\s+(?:[A-Z][\w.'-]+|of|the|and))*)\b/g;

  // Match a citation immediately after the name (with optional comma/spaces)
  const citRe =
    /^[,\s]*((?:\[\d{4}\]\s+[A-Z][A-Z\d]*[A-Za-z]*(?:\s*\([^)]+\))?\s+\d+|\d{4}\s+[A-Z][A-Z\d]+(?:\s*\([^)]+\))?\s+\d+|\(\d{4}\),?\s+\d+[^.;\n]{0,40}?\d+(?:\s*\([A-Z][^)]*\))?))/;

  for (const m of text.matchAll(nameRe)) {
    const left = m[1].trim().replace(/\s+/g, " ");
    const right = m[2].trim().replace(/\s+/g, " ");
    // Filter obvious noise: each side should have a real name token
    if (left.length < 2 || right.length < 2) continue;
    // Don't accept names that are just stop-words
    if (/^(?:and|of|the|for)$/i.test(left) || /^(?:and|of|the|for)$/i.test(right)) continue;

    const caseName = `${left} v ${right}`;
    const key = caseName.toLowerCase();
    if (seen.has(key)) continue;

    const start = m.index ?? 0;
    const after = text.slice(start + m[0].length, start + m[0].length + 120);
    const citMatch = after.match(citRe);
    const citation = citMatch ? citMatch[1].trim() : "";
    const fullLength = m[0].length + (citMatch ? citMatch[0].length : 0);

    seen.add(key);
    found.push({
      caseName,
      citation,
      rawMatch: text.slice(start, start + fullLength).trim(),
      context: extractContext(text, start, fullLength),
    });
  }

  return found;
}
