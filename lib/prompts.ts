type BuildPromptArgs = {
  claudeAnswer: string;
  documentText: string;
  userQuestion?: string;
};

export function buildVerificationPrompt({
  claudeAnswer,
  documentText,
  userQuestion,
}: BuildPromptArgs): string {
  const parts: string[] = [];

  parts.push(
    "You are assisting with legal research cross-verification. Another AI (Claude) produced the answer below. " +
      "Your job is to independently evaluate it against the attached document and legal reasoning."
  );

  if (userQuestion && userQuestion.trim()) {
    parts.push(`\nOriginal question:\n${userQuestion.trim()}`);
  }

  parts.push(
    `\nClaude's answer to verify:\n"""\n${claudeAnswer.trim()}\n"""`
  );

  if (documentText && documentText.trim()) {
    parts.push(
      `\nReference document:\n"""\n${documentText.trim().slice(0, 60000)}\n"""`
    );
  }

  parts.push(
    "\nProvide:\n" +
      "1. Overall assessment (agree / partially agree / disagree) with a one-sentence reason.\n" +
      "2. Specific factual or legal errors you found, quoting the part of Claude's answer.\n" +
      "3. Anything important that Claude missed from the document.\n" +
      "4. Your own concise answer to the original question.\n" +
      "Be direct. If Claude is correct, say so plainly."
  );

  return parts.join("\n");
}
