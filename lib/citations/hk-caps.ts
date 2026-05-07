/**
 * Maps common Hong Kong ordinance names to their Chapter (Cap) numbers.
 * URL pattern: https://www.elegislation.gov.hk/hk/cap{N}
 *              https://www.elegislation.gov.hk/hk/cap{N}/s{section}
 *
 * Source: https://www.elegislation.gov.hk/
 */

export type HkCap = {
  cap: string;   // e.g. "57", "622", "486"
  fullName: string;
};

const CAPS: HkCap[] = [
  // Employment & Labour
  { cap: "57",   fullName: "Employment Ordinance" },
  { cap: "55",   fullName: "Labour Relations Ordinance" },
  { cap: "332",  fullName: "Trade Unions Ordinance" },
  { cap: "258",  fullName: "Employees' Compensation Ordinance" },
  { cap: "302",  fullName: "Occupational Safety and Health Ordinance" },
  { cap: "45",   fullName: "Factories and Industrial Undertakings Ordinance" },

  // Companies & Business
  { cap: "622",  fullName: "Companies Ordinance" },
  { cap: "32",   fullName: "Companies Ordinance" }, // old cap 32 pre-2014 rewrite
  { cap: "112",  fullName: "Business Registration Ordinance" },
  { cap: "26",   fullName: "Partnership Ordinance" },
  { cap: "553",  fullName: "Limited Partnership Ordinance" },
  { cap: "32H",  fullName: "Companies (Winding Up and Miscellaneous Provisions) Ordinance" },

  // Land & Property
  { cap: "7",    fullName: "Landlord and Tenant (Consolidation) Ordinance" },
  { cap: "585",  fullName: "Land Titles Ordinance" },
  { cap: "128",  fullName: "Land Registration Ordinance" },
  { cap: "127",  fullName: "Lands Resumption Ordinance" },
  { cap: "123",  fullName: "Buildings Ordinance" },
  { cap: "1024", fullName: "Strata Titles Ordinance" },
  { cap: "344",  fullName: "Government Rent (Assessment and Collection) Ordinance" },

  // Criminal Law
  { cap: "200",  fullName: "Crimes Ordinance" },
  { cap: "221",  fullName: "Criminal Procedure Ordinance" },
  { cap: "228",  fullName: "Summary Offences Ordinance" },
  { cap: "238",  fullName: "Theft Ordinance" },
  { cap: "134",  fullName: "Dangerous Drugs Ordinance" },
  { cap: "201",  fullName: "Firearms and Ammunition Ordinance" },

  // Courts & Procedure
  { cap: "4",    fullName: "High Court Ordinance" },
  { cap: "336",  fullName: "District Court Ordinance" },
  { cap: "227",  fullName: "Magistrates Ordinance" },
  { cap: "347",  fullName: "Limitation Ordinance" },
  { cap: "8",    fullName: "Evidence Ordinance" },
  { cap: "91",   fullName: "Legal Aid Ordinance" },
  { cap: "25",   fullName: "Legal Practitioners Ordinance" },

  // Family & Succession
  { cap: "179",  fullName: "Matrimonial Causes Ordinance" },
  { cap: "192",  fullName: "Matrimonial Proceedings and Property Ordinance" },
  { cap: "13",   fullName: "Guardianship of Minors Ordinance" },
  { cap: "10",   fullName: "Probate and Administration Ordinance" },
  { cap: "481",  fullName: "Inheritance (Provision for Family and Dependants) Ordinance" },
  { cap: "29",   fullName: "Wills Ordinance" },
  { cap: "30",   fullName: "Law Amendment and Reform (Consolidation) Ordinance" },

  // Discrimination & Human Rights
  { cap: "383",  fullName: "Hong Kong Bill of Rights Ordinance" },
  { cap: "480",  fullName: "Sex Discrimination Ordinance" },
  { cap: "487",  fullName: "Disability Discrimination Ordinance" },
  { cap: "602",  fullName: "Race Discrimination Ordinance" },
  { cap: "527",  fullName: "Family Status Discrimination Ordinance" },

  // Privacy & Data
  { cap: "486",  fullName: "Personal Data (Privacy) Ordinance" },

  // Arbitration & Mediation
  { cap: "609",  fullName: "Arbitration Ordinance" },
  { cap: "620",  fullName: "Mediation Ordinance" },

  // Finance & Securities
  { cap: "571",  fullName: "Securities and Futures Ordinance" },
  { cap: "155",  fullName: "Banking Ordinance" },
  { cap: "41",   fullName: "Insurance Ordinance" },
  { cap: "24",   fullName: "Money Lenders Ordinance" },

  // Tax
  { cap: "112",  fullName: "Inland Revenue Ordinance" },
  { cap: "109",  fullName: "Stamp Duty Ordinance" },

  // Immigration
  { cap: "115",  fullName: "Immigration Ordinance" },
  { cap: "115A", fullName: "Immigration (Amendment) Ordinance" },

  // Constitutional
  { cap: "2101", fullName: "Basic Law" },
];

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const INDEX = new Map<string, HkCap>();
for (const cap of CAPS) {
  const key = normalise(cap.fullName);
  if (!INDEX.has(key)) INDEX.set(key, cap);

  // Without "ordinance" suffix
  const withoutSuffix = key.replace(/\s*ordinance$/, "").trim();
  if (withoutSuffix && !INDEX.has(withoutSuffix)) INDEX.set(withoutSuffix, cap);

  // Cap number itself
  INDEX.set(`cap ${cap.cap}`, cap);
  INDEX.set(`cap. ${cap.cap}`, cap);
  INDEX.set(cap.cap, cap);
}

export function findHkCap(name: string): HkCap | null {
  const key = normalise(name);
  if (!key || key.length < 2) return null;

  if (INDEX.has(key)) return INDEX.get(key)!;

  // Without year (HK ordinances rarely have year in name, but handle it)
  const withoutYear = key.replace(/,?\s*\d{4}$/, "").trim();
  if (withoutYear && INDEX.has(withoutYear)) return INDEX.get(withoutYear)!;

  // Substring match
  if (withoutYear.length >= 5) {
    for (const [indexed, cap] of INDEX.entries()) {
      if (indexed.length < 4) continue;
      if (indexed.includes(withoutYear) || withoutYear.includes(indexed)) {
        return cap;
      }
    }
  }

  return null;
}

export { CAPS };
