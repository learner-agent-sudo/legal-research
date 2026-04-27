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

export type BuildPromptArgs = {
  claudeAnswer: string;
  documentText: string;
  userQuestion?: string;
};

export const PROMPT_PLACEHOLDERS = {
  userQuestion: "{userQuestion}",
  claudeAnswer: "{claudeAnswer}",
  documentText: "{documentText}",
};

const MAX_DOC_CHARS = 60000;

const HONESTY_RULE =
  "Important: you cannot open URLs or browse the web. Verify based on your training only. " +
  "If you are not certain a citation is correct, say so explicitly — do NOT invent details.";

const VERDICT_RULE = `Format requirement: your VERY FIRST line must be exactly one of these three tags, on its own line:
[GREEN] — no significant problems
[YELLOW] — some concerns or partial issues
[RED] — major errors or strong disagreement
Then leave a blank line and write your full response in Markdown (use **bold** for the parts of the answer that are problematic).`;

const COMMON_BODY = `Original question:
{userQuestion}

Answer to verify (from another AI):
"""
{claudeAnswer}
"""

Reference document:
"""
{documentText}
"""`;

export const ROLE_TEMPLATES: Record<VerificationRole, string> = {
  comprehensive: `You are assisting with legal-research cross-verification. Independently evaluate the answer below against the reference document and your legal knowledge.

${HONESTY_RULE}

${VERDICT_RULE}

${COMMON_BODY}

Provide:
1. Overall assessment (agree / partially agree / disagree) with a one-sentence reason.
2. Specific factual or legal errors — **bold** the exact phrases from the answer that are wrong.
3. Anything important missed from the document.
4. Your own concise answer to the original question.
Be direct. If the answer is correct, say so plainly.`,

  statute: `You are a legal-citation auditor. Your ONLY job is to check every statute, ordinance, regulation, or section number cited in the answer below.

${HONESTY_RULE}

${VERDICT_RULE}
Use [GREEN] if all citations look correct, [YELLOW] if some look wrong/unsure, [RED] if many appear wrong or fabricated.

${COMMON_BODY}

For each statute / section cited, output a row:
- Citation as written: ...
- Likely correct? yes / no / unsure (with one-sentence reason)
- Suggested correct citation if you think the answer got it wrong

Ignore case-law citations and general reasoning — focus only on legislation. If no statutes are cited, say so and stop.`,

  "case-law": `You are a case-law auditor. Your ONLY job is to check every case cited in the answer below.

${HONESTY_RULE}

${VERDICT_RULE}
Use [GREEN] if all cases look real and correctly used, [YELLOW] if some are unsure or misapplied, [RED] if any case looks fabricated.

${COMMON_BODY}

For each case cited, output a row:
- Case name as written: ...
- Citation as written: ...
- Likely real case? yes / no / unsure (with reason — flag any that look fabricated)
- Are the facts as described in the answer consistent with what you know about the case? yes / no / unsure
- Anything misrepresented or misapplied?

Ignore statutes and general reasoning — focus only on cases. If no cases are cited, say so and stop. BE STRICT: hallucinated case citations are a known issue with AI legal answers.`,

  logic: `You are a legal-reasoning reviewer. Your ONLY job is to evaluate the LOGIC of the answer below — not whether citations are correct.
Treat all cited authorities as if they exist and say what the answer claims. Focus purely on whether the argument flows.

${VERDICT_RULE}
Use [GREEN] if the reasoning is sound, [YELLOW] for minor gaps, [RED] for serious logical flaws.

${COMMON_BODY}

Provide:
1. Does the conclusion follow from the premises? yes / partially / no — explain.
2. List any logical gaps, leaps, or unstated assumptions.
3. List any internal contradictions.
4. Is the structure suitable for a legal answer (issue → rule → application → conclusion)?
5. One-paragraph overall verdict on the reasoning.`,

  counter: `You are opposing counsel. Your ONLY job is to build the STRONGEST argument AGAINST the answer below — the way an adversary would attack it in court.

${HONESTY_RULE}

${VERDICT_RULE}
For this role the verdict reflects how DAMAGING the counter-argument is to the original answer: [GREEN] = the answer holds up well, [YELLOW] = some weak spots, [RED] = serious counter-argument exists.

${COMMON_BODY}

Provide:
1. The single strongest counter-argument, in one paragraph.
2. The 2-3 weakest points in the answer that an opponent would attack first.
3. Any authorities (cases or statutes) that cut AGAINST the answer's conclusion.
4. Alternative interpretations of the document that the answer ignored.
Be adversarial but accurate — do not invent authorities.`,
};

export type PromptOverrides = Partial<Record<VerificationRole, string>>;

export function buildPromptForRole(
  role: VerificationRole,
  args: BuildPromptArgs,
  overrides?: PromptOverrides
): string {
  const template = overrides?.[role] ?? ROLE_TEMPLATES[role];
  const userQuestion = args.userQuestion?.trim() || "[no question provided]";
  const claudeAnswer = args.claudeAnswer.trim();
  const documentText =
    args.documentText?.trim().slice(0, MAX_DOC_CHARS) || "[no document attached]";

  return template
    .split(PROMPT_PLACEHOLDERS.userQuestion).join(userQuestion)
    .split(PROMPT_PLACEHOLDERS.claudeAnswer).join(claudeAnswer)
    .split(PROMPT_PLACEHOLDERS.documentText).join(documentText);
}
