"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  PROMPT_PLACEHOLDERS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_TEMPLATES,
  type PromptOverrides,
  type VerificationRole,
} from "@/lib/prompts";
import {
  clearPromptOverride,
  loadPromptOverrides,
  savePromptOverrides,
} from "@/lib/storage";

const ROLES: VerificationRole[] = [
  "comprehensive",
  "statute",
  "case-law",
  "logic",
  "counter",
];

export default function PromptsPage() {
  const [overrides, setOverrides] = useState<PromptOverrides>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);
  const [savedFlash, setSavedFlash] = useState<string>("");

  useEffect(() => {
    const o = loadPromptOverrides();
    setOverrides(o);
    const initialDrafts: Record<string, string> = {};
    for (const r of ROLES) {
      initialDrafts[r] = o[r] ?? ROLE_TEMPLATES[r];
    }
    setDrafts(initialDrafts);
    setHydrated(true);
  }, []);

  function isCustomized(role: VerificationRole): boolean {
    return overrides[role] !== undefined && overrides[role] !== ROLE_TEMPLATES[role];
  }

  function isDirty(role: VerificationRole): boolean {
    const current = overrides[role] ?? ROLE_TEMPLATES[role];
    return drafts[role] !== current;
  }

  function handleSave(role: VerificationRole) {
    const next = { ...overrides, [role]: drafts[role] };
    if (drafts[role] === ROLE_TEMPLATES[role]) {
      delete next[role];
    }
    setOverrides(next);
    savePromptOverrides(next);
    setSavedFlash(role);
    setTimeout(() => setSavedFlash(""), 1500);
  }

  function handleReset(role: VerificationRole) {
    if (!confirm(`Reset "${ROLE_LABELS[role]}" to the built-in default?`)) return;
    clearPromptOverride(role);
    const next = { ...overrides };
    delete next[role];
    setOverrides(next);
    setDrafts((prev) => ({ ...prev, [role]: ROLE_TEMPLATES[role] }));
  }

  function handleChange(role: VerificationRole, value: string) {
    setDrafts((prev) => ({ ...prev, [role]: value }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Prompt templates</h1>
        <p className="mt-1 text-sm text-slate-600">
          These are the exact instructions sent to each AI model based on the role you
          assign. You can edit them — your changes are saved in this browser only and used
          on every Verify run.
        </p>
        <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
          <p className="font-medium">Available placeholders</p>
          <p className="mt-1">
            These get replaced with what you typed/uploaded at run time:
          </p>
          <ul className="mt-1 list-disc pl-5 font-mono">
            <li>
              <code>{PROMPT_PLACEHOLDERS.userQuestion}</code> — your original question
            </li>
            <li>
              <code>{PROMPT_PLACEHOLDERS.claudeAnswer}</code> — the answer being verified
            </li>
            <li>
              <code>{PROMPT_PLACEHOLDERS.documentText}</code> — the uploaded document
            </li>
          </ul>
        </div>
      </div>

      {!hydrated && <p className="text-sm text-slate-500">Loading…</p>}

      {hydrated &&
        ROLES.map((role) => {
          const customized = isCustomized(role);
          const dirty = isDirty(role);
          return (
            <section key={role} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">
                    {ROLE_LABELS[role]}
                    {customized && (
                      <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Customized
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-slate-600">{ROLE_DESCRIPTIONS[role]}</p>
                </div>
                <code className="rounded bg-slate-100 px-2 py-0.5 text-xs">{role}</code>
              </div>
              <textarea
                value={drafts[role] ?? ""}
                onChange={(e) => handleChange(role, e.target.value)}
                rows={Math.min(20, (drafts[role] ?? "").split("\n").length + 1)}
                className="mt-2 w-full resize-y rounded border bg-slate-50 p-3 font-mono text-xs leading-relaxed focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-200"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleSave(role)}
                  disabled={!dirty}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-400"
                >
                  Save changes
                </button>
                {customized && (
                  <button
                    onClick={() => handleReset(role)}
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    Reset to default
                  </button>
                )}
                {savedFlash === role && (
                  <span className="text-xs text-green-700">Saved.</span>
                )}
                {dirty && savedFlash !== role && (
                  <span className="text-xs text-amber-700">Unsaved changes</span>
                )}
              </div>
            </section>
          );
        })}

      <p className="text-xs text-slate-500">
        Tip: edits are saved in this browser via localStorage. Use{" "}
        <Link href="/settings" className="text-blue-600 hover:underline">
          Settings → Export
        </Link>{" "}
        to copy them to another browser.
      </p>
    </div>
  );
}
