import { describe, it, expect } from "vitest";
import {
  buildPromptForRole,
  buildAdjudicationPrompt,
  buildConsolidationPrompt,
  ROLE_TEMPLATES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  VerificationRole,
  type ConsolidationCritique,
} from "@/lib/prompts";

const ROLES: VerificationRole[] = ["comprehensive", "statute", "case-law", "logic", "counter"];

const BASE_ARGS = {
  claudeAnswer: "The Employment Standards Act requires two weeks notice.",
  documentText: "Section 57 of the ESA sets out minimum notice periods.",
  userQuestion: "What notice period is required under Ontario law?",
};

// ── ROLE_LABELS / ROLE_DESCRIPTIONS ──────────────────────────────────────────

describe("ROLE_LABELS", () => {
  it("has an entry for every role", () => {
    for (const role of ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy();
    }
  });
});

describe("ROLE_DESCRIPTIONS", () => {
  it("has an entry for every role", () => {
    for (const role of ROLES) {
      expect(ROLE_DESCRIPTIONS[role]).toBeTruthy();
    }
  });
});

// ── ROLE_TEMPLATES ────────────────────────────────────────────────────────────

describe("ROLE_TEMPLATES", () => {
  it("each template contains all three placeholders", () => {
    for (const role of ROLES) {
      const t = ROLE_TEMPLATES[role];
      expect(t, `${role}: missing {claudeAnswer}`).toContain("{claudeAnswer}");
      expect(t, `${role}: missing {documentText}`).toContain("{documentText}");
      expect(t, `${role}: missing {userQuestion}`).toContain("{userQuestion}");
    }
  });

  it("every template contains at least one verdict tag ([GREEN]/[YELLOW]/[RED])", () => {
    for (const role of ROLES) {
      const t = ROLE_TEMPLATES[role];
      expect(t, `${role}: no verdict tags`).toMatch(/\[GREEN\]|\[YELLOW\]|\[RED\]/);
    }
  });

  it("statute template mentions 'legislation' or 'statute'", () => {
    expect(ROLE_TEMPLATES.statute.toLowerCase()).toMatch(/statute|legislation/);
  });

  it("case-law template mentions 'case' or 'hallucinate'", () => {
    expect(ROLE_TEMPLATES["case-law"].toLowerCase()).toMatch(/case|hallucinate|fabricat/);
  });

  it("logic template does not mention honesty rule (no URL browsing note)", () => {
    // The logic template explicitly does not include HONESTY_RULE
    expect(ROLE_TEMPLATES.logic).not.toContain("cannot open URLs");
  });

  it("counter template mentions 'adversar' or 'opposing'", () => {
    expect(ROLE_TEMPLATES.counter.toLowerCase()).toMatch(/adversar|opposing/);
  });
});

// ── buildPromptForRole ────────────────────────────────────────────────────────

describe("buildPromptForRole — placeholder substitution", () => {
  for (const role of ROLES) {
    it(`substitutes all placeholders for role: ${role}`, () => {
      const prompt = buildPromptForRole(role, BASE_ARGS);
      expect(prompt).toContain(BASE_ARGS.claudeAnswer);
      expect(prompt).toContain(BASE_ARGS.documentText);
      expect(prompt).toContain(BASE_ARGS.userQuestion);
      // No raw placeholders should remain
      expect(prompt).not.toContain("{claudeAnswer}");
      expect(prompt).not.toContain("{documentText}");
      expect(prompt).not.toContain("{userQuestion}");
    });
  }
});

describe("buildPromptForRole — missing optional fields", () => {
  it("uses fallback text when userQuestion is omitted", () => {
    const prompt = buildPromptForRole("comprehensive", {
      claudeAnswer: "Some answer.",
      documentText: "Some doc.",
    });
    expect(prompt).toContain("[no question provided]");
  });

  it("uses fallback text when documentText is empty", () => {
    const prompt = buildPromptForRole("comprehensive", {
      claudeAnswer: "Some answer.",
      documentText: "",
    });
    expect(prompt).toContain("[no document attached]");
  });

  it("trims leading/trailing whitespace from claudeAnswer", () => {
    const prompt = buildPromptForRole("statute", {
      claudeAnswer: "   trimmed answer   ",
      documentText: "doc",
    });
    expect(prompt).toContain("trimmed answer");
    expect(prompt).not.toContain("   trimmed answer   ");
  });
});

describe("buildPromptForRole — document truncation", () => {
  it("truncates documentText to ~60000 chars", () => {
    const longDoc = "a".repeat(80000);
    const prompt = buildPromptForRole("comprehensive", {
      claudeAnswer: "answer",
      documentText: longDoc,
    });
    // 60000 a's should appear; 70000 should not
    expect(prompt).toContain("a".repeat(60000));
    expect(prompt).not.toContain("a".repeat(60001));
  });

  it("does not truncate short documents", () => {
    const shortDoc = "short document";
    const prompt = buildPromptForRole("logic", {
      claudeAnswer: "answer",
      documentText: shortDoc,
    });
    expect(prompt).toContain(shortDoc);
  });
});

describe("buildPromptForRole — overrides", () => {
  it("uses override template instead of built-in when provided", () => {
    const custom = "Custom: {claudeAnswer} | {documentText} | {userQuestion}";
    const prompt = buildPromptForRole(
      "comprehensive",
      BASE_ARGS,
      { comprehensive: custom }
    );
    expect(prompt).toBe(
      `Custom: ${BASE_ARGS.claudeAnswer} | ${BASE_ARGS.documentText} | ${BASE_ARGS.userQuestion}`
    );
  });

  it("ignores override for a different role", () => {
    const custom = "Override only for statute";
    const prompt = buildPromptForRole(
      "logic",
      BASE_ARGS,
      { statute: custom }
    );
    // logic prompt should be the built-in template, not the override
    expect(prompt).not.toContain("Override only for statute");
    expect(prompt).toContain(BASE_ARGS.claudeAnswer);
  });
});

// ── buildAdjudicationPrompt ───────────────────────────────────────────────────

describe("buildAdjudicationPrompt", () => {
  const ADJ_ARGS = {
    ...BASE_ARGS,
    challengerLabel: "Llama 3.3 70B (Groq, free)",
    challengerVerdict: "yellow" as const,
    challengerCritique: "The answer misses section 58 which extends the period.",
  };

  it("includes the challenger label in the output", () => {
    const prompt = buildAdjudicationPrompt(ADJ_ARGS);
    expect(prompt).toContain("Llama 3.3 70B (Groq, free)");
  });

  it("uppercases the verdict tag from the challenger", () => {
    const prompt = buildAdjudicationPrompt(ADJ_ARGS);
    expect(prompt).toContain("[YELLOW]");
    expect(prompt).not.toContain("[yellow]");
  });

  it("uppercases RED verdict correctly", () => {
    const prompt = buildAdjudicationPrompt({ ...ADJ_ARGS, challengerVerdict: "red" });
    expect(prompt).toContain("[RED]");
  });

  it("includes the challenger's critique text", () => {
    const prompt = buildAdjudicationPrompt(ADJ_ARGS);
    expect(prompt).toContain(ADJ_ARGS.challengerCritique);
  });

  it("includes all three input texts", () => {
    const prompt = buildAdjudicationPrompt(ADJ_ARGS);
    expect(prompt).toContain(BASE_ARGS.claudeAnswer);
    expect(prompt).toContain(BASE_ARGS.documentText);
    expect(prompt).toContain(BASE_ARGS.userQuestion);
  });

  it("includes all three adjudication verdict tags", () => {
    const prompt = buildAdjudicationPrompt(ADJ_ARGS);
    expect(prompt).toContain("[GREEN]");
    expect(prompt).toContain("[YELLOW]");
    expect(prompt).toContain("[RED]");
  });

  it("includes the honesty rule about not browsing URLs", () => {
    const prompt = buildAdjudicationPrompt(ADJ_ARGS);
    expect(prompt).toContain("cannot open URLs");
  });

  it("uses fallback when userQuestion is omitted", () => {
    const prompt = buildAdjudicationPrompt({
      ...ADJ_ARGS,
      userQuestion: undefined,
    });
    expect(prompt).toContain("[no question provided]");
  });

  it("truncates long documentText", () => {
    const prompt = buildAdjudicationPrompt({
      ...ADJ_ARGS,
      documentText: "b".repeat(80000),
    });
    expect(prompt).toContain("b".repeat(60000));
    expect(prompt).not.toContain("b".repeat(60001));
  });
});

// ── buildConsolidationPrompt ──────────────────────────────────────────────────

describe("buildConsolidationPrompt", () => {
  const SAMPLE_CRITIQUES: ConsolidationCritique[] = [
    {
      modelLabel: "Llama 3.3 70B",
      verdict: "red",
      body: "The cited section number is wrong. Section 14 does not exist in the act.",
    },
    {
      modelLabel: "Gemini 2.5 Flash",
      verdict: "yellow",
      body: "The reasoning is mostly sound but misses the exception in section 15.",
    },
  ];

  const ARGS = {
    claudeAnswer: "Section 14 of the ESA requires X.",
    documentText: "Section 13 talks about Y.",
    userQuestion: "Does the ESA require X?",
    critiques: SAMPLE_CRITIQUES,
  };

  it("includes all severity tags in instructions", () => {
    const p = buildConsolidationPrompt(ARGS);
    expect(p).toContain("[CRITICAL]");
    expect(p).toContain("[MODERATE]");
    expect(p).toContain("[MINOR]");
  });

  it("includes each critique's model label and uppercased verdict", () => {
    const p = buildConsolidationPrompt(ARGS);
    expect(p).toContain("Llama 3.3 70B");
    expect(p).toContain("[RED]");
    expect(p).toContain("Gemini 2.5 Flash");
    expect(p).toContain("[YELLOW]");
  });

  it("includes each critique's body text", () => {
    const p = buildConsolidationPrompt(ARGS);
    expect(p).toContain("Section 14 does not exist");
    expect(p).toContain("misses the exception");
  });

  it("includes the answer, document, and question", () => {
    const p = buildConsolidationPrompt(ARGS);
    expect(p).toContain("Section 14 of the ESA requires X.");
    expect(p).toContain("Section 13 talks about Y.");
    expect(p).toContain("Does the ESA require X?");
  });

  it("uses fallback when userQuestion is omitted", () => {
    const p = buildConsolidationPrompt({ ...ARGS, userQuestion: undefined });
    expect(p).toContain("[no question provided]");
  });

  it("includes the count of models in the section heading", () => {
    const p = buildConsolidationPrompt(ARGS);
    expect(p).toContain("(2 models)");
  });

  it("works with a single critique", () => {
    const p = buildConsolidationPrompt({ ...ARGS, critiques: SAMPLE_CRITIQUES.slice(0, 1) });
    expect(p).toContain("(1 models)");
    expect(p).toContain("Llama 3.3 70B");
  });

  it("instructs the model to group by theme not by model", () => {
    const p = buildConsolidationPrompt(ARGS);
    expect(p.toLowerCase()).toContain("by theme");
  });

  it("truncates very long documentText", () => {
    const p = buildConsolidationPrompt({
      ...ARGS,
      documentText: "x".repeat(80000),
    });
    expect(p).toContain("x".repeat(60000));
    expect(p).not.toContain("x".repeat(60001));
  });
});
