import { NextResponse } from "next/server";
import { extractCitations } from "@/lib/citations/extract";
import { findOntarioAct } from "@/lib/citations/ontario-acts";
import {
  normaliseSection,
  htmlToText,
  extractSectionFromText,
} from "@/lib/citations/ontario-parser";
import { buildPromptForRole, buildAdjudicationPrompt } from "@/lib/prompts";
import {
  buildCitationVerifyPrompt,
  parseVerdict,
} from "@/lib/citations/verify-prompt";

export const runtime = "nodejs";

type Check = {
  name: string;
  status: "pass" | "fail";
  detail?: string;
  ms: number;
};

function run(name: string, fn: () => void): Check {
  const t0 = Date.now();
  try {
    fn();
    return { name, status: "pass", ms: Date.now() - t0 };
  } catch (err) {
    return {
      name,
      status: "fail",
      detail: err instanceof Error ? err.message : String(err),
      ms: Date.now() - t0,
    };
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

export async function GET() {
  const checks: Check[] = [];

  // ── Citation extraction ────────────────────────────────────────────────
  checks.push(run("extractCitations finds 'section X of Y Act'", () => {
    const r = extractCitations(
      "Section 14(2) of the Employment Standards Act, 2000 governs records."
    );
    assert(r.length === 1, `expected 1 citation, got ${r.length}`);
    assert(r[0].section === "14(2)", `wrong section: ${r[0].section}`);
  }));

  checks.push(run("extractCitations returns [] for empty input", () => {
    assert(extractCitations("").length === 0, "expected empty array");
  }));

  // ── Ontario act lookup ─────────────────────────────────────────────────
  checks.push(run("findOntarioAct resolves Employment Standards Act, 2000", () => {
    const a = findOntarioAct("Employment Standards Act, 2000");
    assert(a?.code === "00e41", `wrong code: ${a?.code ?? "null"}`);
  }));

  checks.push(run("findOntarioAct returns null for empty input", () => {
    assert(findOntarioAct("") === null, "should return null");
  }));

  // ── Ontario parser ─────────────────────────────────────────────────────
  checks.push(run("normaliseSection strips 's. ' prefix", () => {
    assert(normaliseSection("s. 14(2)") === "14(2)", "wrong normalisation");
  }));

  checks.push(run("htmlToText strips scripts and tags", () => {
    const txt = htmlToText("<p>hello</p><script>alert(1)</script>");
    assert(txt.includes("hello"), "missing body");
    assert(!txt.includes("alert"), "script not stripped");
  }));

  checks.push(run("extractSectionFromText finds section 14", () => {
    const fixture =
      "14 (1) Records shall be kept.\n(2) For three years.\n15 Inspection rules.";
    const r = extractSectionFromText(fixture, "14");
    assert(r !== null, "section 14 not found");
    assert(r!.includes("Records shall be kept"), "missing body text");
    assert(!r!.includes("Inspection"), "bled into section 15");
  }));

  // ── Prompt builders ────────────────────────────────────────────────────
  checks.push(run("buildPromptForRole substitutes placeholders", () => {
    const p = buildPromptForRole("comprehensive", {
      claudeAnswer: "TEST_ANSWER",
      documentText: "TEST_DOC",
      userQuestion: "TEST_Q",
    });
    assert(p.includes("TEST_ANSWER"), "missing answer");
    assert(p.includes("TEST_DOC"), "missing doc");
    assert(p.includes("TEST_Q"), "missing question");
    assert(!p.includes("{claudeAnswer}"), "placeholder not replaced");
  }));

  checks.push(run("buildAdjudicationPrompt includes verdict tag", () => {
    const p = buildAdjudicationPrompt({
      claudeAnswer: "a",
      documentText: "d",
      challengerLabel: "Test Model",
      challengerVerdict: "yellow",
      challengerCritique: "c",
    });
    assert(p.includes("[YELLOW]"), "missing uppercased verdict");
    assert(p.includes("Test Model"), "missing challenger label");
  }));

  checks.push(run("buildCitationVerifyPrompt + parseVerdict round-trip", () => {
    const p = buildCitationVerifyPrompt({
      jurisdiction: "Ontario, Canada",
      act: "ESA",
      section: "14",
      sectionText: "Records shall be retained.",
      sourceUrl: "https://example.com",
      claudeClaim: "Section 14 requires records.",
    });
    assert(p.includes("[ACCURATE]"), "missing verdict tag");
    assert(parseVerdict("[WRONG]\n\nbody") === "wrong", "parseVerdict broken");
  }));

  // ── Environment ────────────────────────────────────────────────────────
  const env = {
    nodeVersion: process.version,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    vercelUrl: process.env.VERCEL_URL ?? null,
    vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    vercelGitCommitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    sessionSecretConfigured: Boolean(process.env.SESSION_SECRET?.trim()),
    upstashConfigured: Boolean(
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ),
  };

  const summary = {
    total: checks.length,
    passed: checks.filter((c) => c.status === "pass").length,
    failed: checks.filter((c) => c.status === "fail").length,
  };

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    summary,
    checks,
    env,
  });
}
