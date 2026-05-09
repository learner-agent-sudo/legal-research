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
  SCC: "ca", CSC: "ca",
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
 * Parse a neutral citation into its three components.
 * Accepts "2008 SCC 39", "[2019] ONCA 123", etc.
 * Returns null if the citation isn't a parseable neutral form (e.g. parallel
 * citations like "(2019), 50 OR (3d) 1" don't have a usable doc slug).
 */
export function parseNeutralCitation(
  citation: string
): { year: number; courtAbbrev: string; courtSlug: string; number: number } | null {
  const m = citation.match(/(?:\[)?(\d{4})(?:\])?\s+([A-Z]{2,8})\s+(\d+)/);
  if (!m) return null;
  const courtUpper = m[2];
  if (!COURT_TO_JURISDICTION[courtUpper]) return null;
  return {
    year: parseInt(m[1], 10),
    courtAbbrev: courtUpper,
    courtSlug: courtUpper.toLowerCase(),
    number: parseInt(m[3], 10),
  };
}

/**
 * Build a deterministic canlii.org case URL from a neutral citation.
 * E.g. "2008 SCC 39" → https://www.canlii.org/en/ca/scc/doc/2008/2008scc39/2008scc39.html
 * Returns null if the citation can't be parsed (no year/court/number triple).
 */
export function citationToCanLIIDocUrl(citation: string): string | null {
  const p = parseNeutralCitation(citation);
  if (!p) return null;
  const jurisdiction = COURT_TO_JURISDICTION[p.courtAbbrev];
  const slug = `${p.year}${p.courtSlug}${p.number}`;
  return `https://www.canlii.org/en/${jurisdiction}/${p.courtSlug}/doc/${p.year}/${slug}/${slug}.html`;
}
