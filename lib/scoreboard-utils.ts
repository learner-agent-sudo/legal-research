/** Sanitise a model id to a safe HTML anchor id */
export function cardAnchorId(modelId: string) {
  return "result-" + modelId.replace(/[^a-zA-Z0-9-_]/g, "-");
}

/**
 * Extract a short, readable excerpt from a model response body.
 * Skips markdown headings, bold labels, and very short lines.
 * Returns the first substantive sentence (≤160 chars).
 */
export function extractExcerpt(body: string): string {
  if (!body) return "";
  const lines = body.split(/\r?\n/).map((l) => l.trim());
  for (const line of lines) {
    if (!line || line.startsWith("#") || /^[-*_]{3,}$/.test(line)) continue;
    const clean = line
      .replace(/^[-*+]\s+/, "")
      .replace(/^\d+\.\s+/, "")
      .replace(/^\*\*[^*]+\*\*[:\s]*/, "")
      .trim();
    if (clean.length < 20) continue;
    const firstSentence =
      clean.match(/^.{20,160}?[.!?](?:\s|$)/)?.[0]?.trim() ??
      clean.slice(0, 160);
    return firstSentence.length < clean.length
      ? firstSentence + "…"
      : firstSentence;
  }
  return "";
}
