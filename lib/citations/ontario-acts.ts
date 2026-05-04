/**
 * Maps common Ontario act names (and short-forms) to their e-Laws statute codes.
 * Code is the URL slug used on ontario.ca/laws/statute/{code}
 *
 * Sources: https://www.ontario.ca/laws/statutes/
 *
 * To add a new act: look up the act on ontario.ca/laws, copy the code from the URL.
 * e.g. https://www.ontario.ca/laws/statute/90c43 → code is "90c43"
 */

export type OntarioAct = {
  code: string;
  fullName: string;
};

const ACTS: OntarioAct[] = [
  // Employment & Labour
  { code: "00e41",  fullName: "Employment Standards Act, 2000" },
  { code: "95l01",  fullName: "Labour Relations Act, 1995" },
  { code: "90w11",  fullName: "Workers' Compensation Act" },
  { code: "97w16",  fullName: "Workplace Safety and Insurance Act, 1997" },
  { code: "90o01",  fullName: "Occupational Health and Safety Act" },
  { code: "90h20",  fullName: "Human Rights Code" },
  { code: "90p33",  fullName: "Pay Equity Act" },

  // Business & Corporations
  { code: "90b16",  fullName: "Business Corporations Act" },
  { code: "10n15",  fullName: "Not-for-Profit Corporations Act, 2010" },
  { code: "90p16",  fullName: "Partnerships Act" },
  { code: "90s05",  fullName: "Sale of Goods Act" },
  { code: "90c40",  fullName: "Consumer Protection Act" },
  { code: "02c30",  fullName: "Consumer Protection Act, 2002" },
  { code: "90c43",  fullName: "Corporations Act" },
  { code: "90b15",  fullName: "Business Practices Act" },
  { code: "90c44",  fullName: "Corporations Tax Act" },

  // Real Property & Land
  { code: "90l05",  fullName: "Land Titles Act" },
  { code: "90r09",  fullName: "Registry Act" },
  { code: "90t22",  fullName: "Tenant Protection Act" },
  { code: "06r17",  fullName: "Residential Tenancies Act, 2006" },
  { code: "90p13",  fullName: "Planning Act" },
  { code: "90d08",  fullName: "Development Charges Act" },
  { code: "97d09",  fullName: "Development Charges Act, 1997" },
  { code: "90m50",  fullName: "Mortgages Act" },
  { code: "90c25",  fullName: "Condominium Act" },
  { code: "98c19",  fullName: "Condominium Act, 1998" },

  // Family & Estates
  { code: "90f03",  fullName: "Family Law Act" },
  { code: "90c20",  fullName: "Children's Law Reform Act" },
  { code: "90s26",  fullName: "Succession Law Reform Act" },
  { code: "90e21",  fullName: "Estates Act" },
  { code: "90t09",  fullName: "Trustee Act" },
  { code: "90g12",  fullName: "Gift to Minors Act" },
  { code: "04c02",  fullName: "Children and Family Services Act" },

  // Courts & Procedure
  { code: "90c43",  fullName: "Courts of Justice Act" },
  { code: "90l10",  fullName: "Limitations Act" },
  { code: "02l24",  fullName: "Limitations Act, 2002" },
  { code: "90e23",  fullName: "Evidence Act" },
  { code: "90j15",  fullName: "Judicature Act" },
  { code: "90r32",  fullName: "Rules of Civil Procedure" },
  { code: "90s22",  fullName: "Statutory Powers Procedure Act" },
  { code: "90p27",  fullName: "Proceedings Against the Crown Act" },
  { code: "90p28",  fullName: "Public Authorities Protection Act" },

  // Privacy & Information
  { code: "90m56",  fullName: "Municipal Freedom of Information and Protection of Privacy Act" },
  { code: "90f31",  fullName: "Freedom of Information and Protection of Privacy Act" },
  { code: "04p15",  fullName: "Personal Health Information Protection Act, 2004" },

  // Environment
  { code: "90e19",  fullName: "Environmental Protection Act" },
  { code: "90o40",  fullName: "Ontario Water Resources Act" },
  { code: "90c12",  fullName: "Clean Water Act" },
  { code: "06c22",  fullName: "Clean Water Act, 2006" },
  { code: "19b07",  fullName: "Environmental Assessment Act" },

  // Criminal & Offences (provincial)
  { code: "90p33",  fullName: "Provincial Offences Act" },
  { code: "90t22",  fullName: "Trespass to Property Act" },
  { code: "90l19",  fullName: "Liquor Licence Act" },

  // Education
  { code: "90e02",  fullName: "Education Act" },
  { code: "90u02",  fullName: "University of Ottawa Act" },
  { code: "90o36",  fullName: "Ontario College of Teachers Act" },

  // Health
  { code: "90h04",  fullName: "Health Protection and Promotion Act" },
  { code: "96l26",  fullName: "Long-Term Care Act, 1994" },
  { code: "07l28",  fullName: "Long-Term Care Homes Act, 2007" },
  { code: "91r33",  fullName: "Regulated Health Professions Act, 1991" },
  { code: "91m43",  fullName: "Medicine Act, 1991" },

  // Tax & Finance
  { code: "92t08",  fullName: "Taxation Act, 2007" },
  { code: "90c16",  fullName: "Corporations Tax Act" },
  { code: "07t11",  fullName: "Taxation Act, 2007" },
  { code: "90m47",  fullName: "Ministry of Revenue Act" },

  // Insurance
  { code: "90i08",  fullName: "Insurance Act" },
  { code: "90m23",  fullName: "Motor Vehicle Accident Claims Act" },
  { code: "96a35",  fullName: "Automobile Insurance Act" },

  // Municipal
  { code: "01m25",  fullName: "Municipal Act, 2001" },
  { code: "06c11",  fullName: "City of Toronto Act, 2006" },
  { code: "90m45",  fullName: "Municipal Elections Act" },
  { code: "96m46",  fullName: "Municipal Elections Act, 1996" },
];

/**
 * Normalise act name for fuzzy matching:
 * lower-case, collapse whitespace, drop punctuation except commas (for year)
 */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9, ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const INDEX = new Map<string, OntarioAct>();
for (const act of ACTS) {
  INDEX.set(normalise(act.fullName), act);

  // also index without the year suffix, e.g. "employment standards act"
  const withoutYear = normalise(act.fullName).replace(/,\s*\d{4}$/, "").trim();
  if (!INDEX.has(withoutYear)) INDEX.set(withoutYear, act);

  // also index short form: first letter of each significant word, drop "Act" / "the" / "of"
  const short = act.fullName
    .replace(/\(.*?\)/g, "")
    .split(" ")
    .filter(
      (w) =>
        !["act", "the", "of", "and", "a", "an", "to", "for", "1994", "1995",
          "1996", "1997", "1998", "1999", "2000", "2001", "2002", "2003",
          "2004", "2005", "2006", "2007", "2008", "2009", "2010"].includes(
          w.toLowerCase()
        )
    )
    .map((w) => w.toLowerCase())
    .join(" ");
  if (short && !INDEX.has(short)) INDEX.set(short, act);
}

export function findOntarioAct(name: string): OntarioAct | null {
  const key = normalise(name);

  // exact match
  if (INDEX.has(key)) return INDEX.get(key)!;

  // without year
  const withoutYear = key.replace(/,?\s*\d{4}$/, "").trim();
  if (INDEX.has(withoutYear)) return INDEX.get(withoutYear)!;

  // substring: find any indexed name that fully contains key, or key contains it
  for (const [indexed, act] of INDEX.entries()) {
    if (indexed.includes(withoutYear) || withoutYear.includes(indexed)) {
      return act;
    }
  }

  return null;
}

export { ACTS };
