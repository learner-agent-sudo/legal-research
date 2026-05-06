/**
 * Builds the prompt sent to an AI model to verify whether Claude's claim
 * about a legislation section matches the actual fetched section text.
 */

export type CitationVerifyArgs = {
  jurisdiction: string;
  act: string;
  section: string;
  sectionText: string;  // live-fetched from official source
  sourceUrl: string;
  claudeClaim: string;  // the sentence(s) Claude wrote about this citation
};

export type CitationVerdict = "accurate" | "partial" | "wrong" | "unverifiable";

export const VERDICT_TAGS: Record<CitationVerdict, string> = {
  accurate:      "[ACCURATE]",
  partial:       "[PARTIAL]",
  wrong:         "[WRONG]",
  unverifiable:  "[UNVERIFIABLE]",
};

export function buildCitationVerifyPrompt(args: CitationVerifyArgs): string {
  return `You are a legal citation auditor. Your job is to check whether a specific claim made about a legislation section is accurate based on the actual section text retrieved from an official source.

Format requirement: your VERY FIRST line must be exactly one of these four tags, on its own line:
[ACCURATE] — what Claude said correctly reflects the section
[PARTIAL] — partially correct but missing important nuance, qualifications, or context
[WRONG] — misstates the law, wrong threshold/deadline/requirement, or the section doesn't support the claim
[UNVERIFIABLE] — the fetched text doesn't contain enough information to judge (e.g. wrong section retrieved, text cut off)
Then leave a blank line and write 2-4 sentences explaining your verdict. Be specific: quote the relevant words from the section.

---

Jurisdiction: ${args.jurisdiction}
Act: ${args.act}
Section: ${args.section}
Source: ${args.sourceUrl}

What Claude claimed about this section:
"""
${args.claudeClaim.trim()}
"""

Actual text of ${args.act}, section ${args.section} (retrieved live from official source):
"""
${args.sectionText.trim().slice(0, 6000)}
"""

Verdict:`;
}

export function parseVerdict(responseText: string): CitationVerdict {
  const first = responseText.trimStart().split("\n")[0].toUpperCase();
  if (first.includes("[ACCURATE]"))     return "accurate";
  if (first.includes("[PARTIAL]"))      return "partial";
  if (first.includes("[WRONG]"))        return "wrong";
  return "unverifiable";
}
