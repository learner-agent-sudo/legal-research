export type VerificationRole =
  | "comprehensive"
  | "statute"
  | "case-law"
  | "logic"
  | "counter";

export const ROLE_LABELS: Record<VerificationRole, string> = {
  comprehensive: "Full review",
  statute: "Statute / legislation check",
  "case-law": "Case-law check",
  logic: "Logic / reasoning check",
  counter: "Counter-argument",
};

export const ROLE_DESCRIPTIONS: Record<VerificationRole, string> = {
  comprehensive: "General agree/disagree, errors, missed points.",
  statute: "Focus only on cited statutes, sections, and regulations.",
  "case-law": "Focus only on cited cases — names, citations, facts.",
  logic: "Focus only on reasoning flow — does the argument hold together.",
  counter: "Build the strongest argument AGAINST the answer.",
};

type BuildPromptArgs = {
  claudeAnswer: string;
  documentText: string;
  userQuestion?: string;
};

const TRUNCATE = 60000;

const HONESTY_RULE =
  "Important: you cannot open URLs or browse the web. Verify based on your training only. " +
  "If you are not certain a citation is correct, say so explicitly — do NOT invent details.";

function commonHeader(args: BuildPromptArgs): string {
  const parts: string[] = [];
  if (args.userQuestion?.trim()) {
    parts.push(`Original question:\n${args.userQuestion.trim()}`);
  }
  parts.push(`Answer to verify (from another AI):\n"""\n${args.claudeAnswer.trim()}\n"""`);
  if (args.documentText?.trim()) {
    parts.push(
      `Reference document:\n"""\n${args.documentText.trim().slice(0, TRUNCATE)}\n"""`
    );
  }
  return parts.join("\n\n");
}

export function buildVerificationPrompt(args: BuildPromptArgs): string {
  return [
    "You are assisting with legal-research cross-verification. Independently evaluate the answer below against the reference document and your legal knowledge.",
    HONESTY_RULE,
    commonHeader(args),
    "Provide:\n" +
      "1. Overall assessment (agree / partially agree / disagree) with a one-sentence reason.\n" +
      "2. Specific factual or legal errors (quote the part of the answer).\n" +
      "3. Anything important missed from the document.\n" +
      "4. Your own concise answer to the original question.\n" +
      "Be direct. If the answer is correct, say so plainly.",
  ].join("\n\n");
}

export function buildStatutePrompt(args: BuildPromptArgs): string {
  return [
    "You are a legal-citation auditor. Your ONLY job is to check every statute, ordinance, regulation, or section number cited in the answer below.",
    HONESTY_RULE,
    commonHeader(args),
    "For each statute / section cited, output a row:\n" +
      "- Citation as written: ...\n" +
      "- Likely correct? yes / no / unsure (with one-sentence reason)\n" +
      "- Suggested correct citation if you think the answer got it wrong\n\n" +
      "Ignore case-law citations and general reasoning — focus only on legislation. " +
      "If no statutes are cited, say so and stop.",
  ].join("\n\n");
}

export function buildCaseLawPrompt(args: BuildPromptArgs): string {
  return [
    "You are a case-law auditor. Your ONLY job is to check every case cited in the answer below.",
    HONESTY_RULE,
    commonHeader(args),
    "For each case cited, output a row:\n" +
      "- Case name as written: ...\n" +
      "- Citation as written: ...\n" +
      "- Likely real case? yes / no / unsure (with reason — flag any that look fabricated)\n" +
      "- Are the facts as described in the answer consistent with what you know about the case? yes / no / unsure\n" +
      "- Anything misrepresented or misapplied?\n\n" +
      "Ignore statutes and general reasoning — focus only on cases. " +
      "If no cases are cited, say so and stop. " +
      "BE STRICT: hallucinated case citations are a known issue with AI legal answers.",
  ].join("\n\n");
}

export function buildLogicPrompt(args: BuildPromptArgs): string {
  return [
    "You are a legal-reasoning reviewer. Your ONLY job is to evaluate the LOGIC of the answer below — not whether citations are correct.",
    "Treat all cited authorities as if they exist and say what the answer claims. Focus purely on whether the argument flows.",
    commonHeader(args),
    "Provide:\n" +
      "1. Does the conclusion follow from the premises? yes / partially / no — explain.\n" +
      "2. List any logical gaps, leaps, or unstated assumptions.\n" +
      "3. List any internal contradictions.\n" +
      "4. Is the structure suitable for a legal answer (issue → rule → application → conclusion)?\n" +
      "5. One-paragraph overall verdict on the reasoning.",
  ].join("\n\n");
}

export function buildCounterPrompt(args: BuildPromptArgs): string {
  return [
    "You are opposing counsel. Your ONLY job is to build the STRONGEST argument AGAINST the answer below — the way an adversary would attack it in court.",
    HONESTY_RULE,
    commonHeader(args),
    "Provide:\n" +
      "1. The single strongest counter-argument, in one paragraph.\n" +
      "2. The 2-3 weakest points in the answer that an opponent would attack first.\n" +
      "3. Any authorities (cases or statutes) that cut AGAINST the answer's conclusion.\n" +
      "4. Alternative interpretations of the document that the answer ignored.\n" +
      "Be adversarial but accurate — do not invent authorities.",
  ].join("\n\n");
}

export function buildPromptForRole(role: VerificationRole, args: BuildPromptArgs): string {
  switch (role) {
    case "statute":
      return buildStatutePrompt(args);
    case "case-law":
      return buildCaseLawPrompt(args);
    case "logic":
      return buildLogicPrompt(args);
    case "counter":
      return buildCounterPrompt(args);
    case "comprehensive":
    default:
      return buildVerificationPrompt(args);
  }
}
