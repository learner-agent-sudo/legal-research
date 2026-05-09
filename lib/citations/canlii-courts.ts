export const COURT_TO_DB: Record<string, string> = {
  // Supreme Court of Canada
  "SCC": "scc",
  // Federal
  "FCA": "fca",
  "FC": "fc",
  "FCJ": "fc",
  "FCT": "fc",
  // Ontario
  "ONCA": "onca",
  "ONSC": "onsc",
  "ONCJ": "oncj",
  "ONDC": "ondc",
  "ONSDIV": "onsc",
  // BC
  "BCCA": "bcca",
  "BCSC": "bcsc",
  // Alberta
  "ABCA": "abca",
  "ABQB": "abqb",
  "ABKB": "abqb",
  // Quebec
  "QCCA": "qcca",
  "QCCS": "qccs",
  // Others
  "NSCA": "nsca",
  "NSSC": "nssc",
  "MBCA": "mbca",
  "MBQB": "mbqb",
  "SKCA": "skca",
  "SKQB": "skqb",
  "NBCA": "nbca",
  "NBQB": "nbqb",
  "PECA": "peca",
  "PEICA": "peca",
  "NLCA": "nlca",
  "NLSC": "nlsc",
  "YKCA": "ykca",
  "YKSC": "yksc",
  "NWTCA": "nwtca",
  "NWTSC": "nwtsc",
  "NUCJ": "nucj",
  "HCJ": "onsc", // Ontario High Court of Justice (older)
  "CA": "onca",  // ambiguous but Ontario CA is most common
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
