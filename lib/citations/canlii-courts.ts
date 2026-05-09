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
