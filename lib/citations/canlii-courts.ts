/**
 * Court abbreviation → CanLII API database ID.
 *
 * Important: the API uses BILINGUAL prefixes for federal/Quebec/SCC databases
 * (e.g. SCC → "csc-scc"), but English-only abbreviations for provincial ones.
 * Web URLs (canlii.org/en/ca/scc/...) use a different shorter form than the
 * API path, so don't assume they match.
 */
export const COURT_TO_DB: Record<string, string> = {
  // Supreme Court of Canada — bilingual code
  "SCC": "csc-scc",
  "CSC": "csc-scc",
  // SCR / DLR / OR etc are reporters, not court codes — they point to SCC
  // for the purposes of CanLII lookup (all SCR volumes are SCC decisions).
  "SCR": "csc-scc",
  // Federal courts — bilingual codes
  "FCA": "caf-fca",   // Cour d'appel fédérale / Federal Court of Appeal
  "CAF": "caf-fca",
  "FC":  "cf-fc",     // Cour fédérale / Federal Court
  "CF":  "cf-fc",
  "FCJ": "cf-fc",
  "FCT": "cf-fc",
  "TCC": "tcc",       // Tax Court of Canada
  // Ontario
  "ONCA":  "onca",
  "ONSC":  "onsc",
  "ONCJ":  "oncj",
  "ONSCDC": "onscdc", // Divisional Court
  "ONSCJ":  "onsc",
  "ONDC":  "onsc",
  "ONSDIV":"onscdc",
  "HCJ":   "onsc",
  // BC
  "BCCA": "bcca",
  "BCSC": "bcsc",
  "BCPC": "bcpc",
  // Alberta
  "ABCA": "abca",
  "ABQB": "abqb",
  "ABKB": "abkb",
  "ABPC": "abpc",
  // Quebec — bilingual
  "QCCA": "qcca",
  "QCCS": "qccs",
  "QCCQ": "qccq",
  // Nova Scotia
  "NSCA": "nsca",
  "NSSC": "nssc",
  "NSPC": "nspc",
  // Manitoba
  "MBCA": "mbca",
  "MBQB": "mbqb",
  "MBKB": "mbkb",
  // Saskatchewan
  "SKCA": "skca",
  "SKQB": "skqb",
  "SKKB": "skkb",
  // New Brunswick
  "NBCA": "nbca",
  "NBQB": "nbqb",
  "NBKB": "nbkb",
  // PEI
  "PECA":  "peca",
  "PEICA": "peca",
  "PESCAD":"pesctd",
  // Newfoundland & Labrador
  "NLCA": "nlca",
  "NLSC": "nlsc",
  "NLPC": "nlpc",
  // Territories
  "YKCA":  "ykca",
  "YKSC":  "yksc",
  "NWTCA": "nwtca",
  "NWTSC": "nwtsc",
  "NUCJ":  "nucj",
  "NUCA":  "nuca",
};

/**
 * Given a citation string like "2008 SCC 39" or "[2019] ONCA 123",
 * returns the CanLII database ID if recognised, or null.
 */
export function courtAbbrevToDb(citation: string): string | null {
  // Find a capitalised token that matches our map
  const tokens = citation.toUpperCase().match(/[A-Z]{2,8}/g) ?? [];
  for (const t of tokens) {
    if (COURT_TO_DB[t]) return COURT_TO_DB[t];
  }
  return null;
}

/**
 * Court abbreviation → jurisdiction code used in canlii.org URL paths.
 * Different from the API database ID: web URLs use 2-letter province codes
 * and unilingual lowercase court slugs (e.g. /en/ca/scc/, /en/on/onca/).
 */
export const COURT_TO_JURISDICTION: Record<string, string> = {
  SCC: "ca", CSC: "ca", SCR: "ca",
  FCA: "ca", CAF: "ca",
  FC: "ca", CF: "ca", FCJ: "ca", FCT: "ca",
  TCC: "ca",
  ONCA: "on", ONSC: "on", ONCJ: "on", ONSCDC: "on", ONSCJ: "on", ONDC: "on", ONSDIV: "on", HCJ: "on",
  BCCA: "bc", BCSC: "bc", BCPC: "bc",
  ABCA: "ab", ABQB: "ab", ABKB: "ab", ABPC: "ab",
  QCCA: "qc", QCCS: "qc", QCCQ: "qc",
  NSCA: "ns", NSSC: "ns", NSPC: "ns",
  MBCA: "mb", MBQB: "mb", MBKB: "mb",
  SKCA: "sk", SKQB: "sk", SKKB: "sk",
  NBCA: "nb", NBQB: "nb", NBKB: "nb",
  PECA: "pe", PEICA: "pe", PESCAD: "pe",
  NLCA: "nl", NLSC: "nl", NLPC: "nl",
  YKCA: "yk", YKSC: "yk",
  NWTCA: "nt", NWTSC: "nt",
  NUCJ: "nu", NUCA: "nu",
};

/**
 * Parse a citation into its three components for CanLII lookup.
 *
 * Handles:
 *   2008 SCC 39            neutral — year-first
 *   [2019] ONCA 123        neutral — bracketed year, no volume
 *   [1992] 1 SCR 623       reporter — bracketed year + volume + reporter + page
 *
 * Reporter citations (SCR, DLR, OR, etc.) are resolved to the court they
 * primarily report on so we can build a CanLII case-detail lookup.
 * Returns null for unrecognised patterns.
 */
export function parseNeutralCitation(
  citation: string
): { year: number; courtAbbrev: string; courtSlug: string; number: number } | null {
  // Form 1: year-first neutral e.g. "2008 SCC 39" or "[2019] ONCA 123" (no volume)
  const neutralM = citation.match(/(?:\[)?(\d{4})(?:\])?\s+([A-Z]{2,8})\s+(\d+)/);
  if (neutralM) {
    const courtUpper = neutralM[2];
    if (COURT_TO_JURISDICTION[courtUpper]) {
      return {
        year: parseInt(neutralM[1], 10),
        courtAbbrev: courtUpper,
        courtSlug: courtUpper.toLowerCase(),
        number: parseInt(neutralM[3], 10),
      };
    }
  }

  // Form 2: reporter with volume e.g. "[1992] 1 SCR 623"
  // Pattern: [year] volume REPORTER page
  const reporterM = citation.match(/\[(\d{4})\]\s+\d+\s+([A-Z]{2,6})\s+(\d+)/);
  if (reporterM) {
    const reporterUpper = reporterM[2];
    if (COURT_TO_JURISDICTION[reporterUpper]) {
      return {
        year: parseInt(reporterM[1], 10),
        courtAbbrev: reporterUpper,
        courtSlug: reporterUpper.toLowerCase(),
        number: parseInt(reporterM[3], 10),
      };
    }
  }

  return null;
}

// Reporters whose page numbers are NOT the same as CanLII case IDs.
// For these we can resolve the court but can't build a direct doc URL.
const REPORTER_CODES = new Set(["SCR", "DLR", "OR", "OAC", "OLR", "AC", "WLR", "ER"]);

/**
 * Build a deterministic canlii.org case URL from a neutral citation.
 * Only works for neutral citations (e.g. "2008 SCC 39", "[2019] ONCA 123")
 * where the number IS the CanLII case ID.
 * Returns null for reporter citations ([1992] 1 SCR 623) and unrecognised forms.
 */
export function citationToCanLIIDocUrl(citation: string): string | null {
  const p = parseNeutralCitation(citation);
  if (!p) return null;
  // Reporter citations have their number as a page number, not a CanLII ID
  if (REPORTER_CODES.has(p.courtAbbrev)) return null;
  const jurisdiction = COURT_TO_JURISDICTION[p.courtAbbrev];
  const slug = `${p.year}${p.courtSlug}${p.number}`;
  return `https://www.canlii.org/en/${jurisdiction}/${p.courtSlug}/doc/${p.year}/${slug}/${slug}.html`;
}
