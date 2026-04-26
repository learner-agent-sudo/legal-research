"use client";

import {
  buildPromptForRole,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type VerificationRole,
} from "@/lib/prompts";

const ROLES: VerificationRole[] = [
  "comprehensive",
  "statute",
  "case-law",
  "logic",
  "counter",
];

const PLACEHOLDERS = {
  userQuestion: "[Your original question will appear here]",
  claudeAnswer: "[Claude's answer will appear here]",
  documentText: "[The text of your uploaded .docx / .txt will appear here]",
};

export default function PromptsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Prompt templates</h1>
        <p className="mt-1 text-sm text-slate-600">
          These are the exact instructions sent to each AI model based on the role you
          assign. The bracketed{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">[placeholders]</code> are
          replaced at run time with whatever you typed and uploaded. Use this page to
          understand what each role does — and to spot wording you might want me to tune.
        </p>
      </div>

      {ROLES.map((role) => {
        const prompt = buildPromptForRole(role, PLACEHOLDERS);
        return (
          <section key={role} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold">{ROLE_LABELS[role]}</h2>
              <code className="rounded bg-slate-100 px-2 py-0.5 text-xs">{role}</code>
            </div>
            <p className="text-sm text-slate-600">{ROLE_DESCRIPTIONS[role]}</p>
            <details className="mt-3" open>
              <summary className="cursor-pointer text-xs font-medium text-slate-700">
                Full prompt sent to the model
              </summary>
              <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs leading-relaxed text-slate-800">
                {prompt}
              </pre>
            </details>
          </section>
        );
      })}

      <section className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-medium">Want a role tuned differently?</p>
        <p className="mt-1">
          Tell me what you want the model to focus on (e.g. &ldquo;for statute checks, also
          flag whether the cited section is in force or repealed&rdquo;), and I&apos;ll
          update the prompt template.
        </p>
      </section>
    </div>
  );
}
