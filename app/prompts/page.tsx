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
import { pullFromServer, pushSnapshot, writeLocalSnapshot } from "@/lib/sync";
import { useToast } from "@/components/Toast";

const ROLES: VerificationRole[] = [
  "comprehensive",
  "statute",
  "case-law",
  "logic",
  "counter",
];

export default function PromptsPage() {
  const toast = useToast();
  const [overrides, setOverrides] = useState<PromptOverrides>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);
  const [savedFlash, setSavedFlash] = useState<string>("");
  const [signedIn, setSignedIn] = useState<boolean>(false);

  function applyOverridesToDrafts(o: PromptOverrides) {
    const initialDrafts: Record<string, string> = {};
    for (const r of ROLES) {
      initialDrafts[r] = o[r] ?? ROLE_TEMPLATES[r];
    }
    setDrafts(initialDrafts);
  }

  useEffect(() => {
    const local = loadPromptOverrides();
    setOverrides(local);
    applyOverridesToDrafts(local);
    setHydrated(true);

    // Pull from server in the background; if signed in and server has
    // overrides, refresh local state with them.
    void (async () => {
      const res = await pullFromServer();
      if (!res.ok) {
        if (res.reason === "not-signed-in") setSignedIn(false);
        return;
      }
      setSignedIn(true);
      if (res.data) {
        writeLocalSnapshot(res.data);
        if (res.data.promptOverrides) {
          setOverrides(res.data.promptOverrides);
          applyOverridesToDrafts(res.data.promptOverrides);
        }
      }
    })();
  }, []);

  async function pushIfSignedIn() {
    if (!signedIn) return;
    await pushSnapshot();
  }

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
    void pushIfSignedIn();
  }

  async function handleReset(role: VerificationRole) {
    const ok = await toast.confirm(`Reset "${ROLE_LABELS[role]}" to the built-in default?`);
    if (!ok) return;
    clearPromptOverride(role);
    const next = { ...overrides };
    delete next[role];
    setOverrides(next);
    setDrafts((prev) => ({ ...prev, [role]: ROLE_TEMPLATES[role] }));
    void pushIfSignedIn();
  }

  function handleChange(role: VerificationRole, value: string) {
    setDrafts((prev) => ({ ...prev, [role]: value }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Prompt templates</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          These are the exact instructions sent to each AI model based on the role you
          assign. You can edit them — your changes are saved in this browser only and used
          on every Verify run.
        </p>
        <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
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

      {!hydrated && <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>}

      {hydrated &&
        ROLES.map((role) => {
          const customized = isCustomized(role);
          const dirty = isDirty(role);
          return (
            <section key={role} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {ROLE_LABELS[role]}
                    {customized && (
                      <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        Customized
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{ROLE_DESCRIPTIONS[role]}</p>
                </div>
                <code className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">{role}</code>
              </div>
              <textarea
                value={drafts[role] ?? ""}
                onChange={(e) => handleChange(role, e.target.value)}
                rows={Math.min(20, (drafts[role] ?? "").split("\n").length + 1)}
                className="mt-2 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:bg-slate-950 dark:focus:ring-blue-900/40"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleSave(role)}
                  disabled={!dirty}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-400 dark:bg-blue-500 dark:hover:bg-blue-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
                >
                  Save changes
                </button>
                {customized && (
                  <button
                    onClick={() => handleReset(role)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Reset to default
                  </button>
                )}
                {savedFlash === role && (
                  <span className="text-xs text-green-700 dark:text-green-400">Saved.</span>
                )}
                {dirty && savedFlash !== role && (
                  <span className="text-xs text-amber-700 dark:text-amber-400">Unsaved changes</span>
                )}
              </div>
            </section>
          );
        })}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Tip: edits are saved in this browser via localStorage. Use{" "}
        <Link href="/settings" className="text-blue-600 hover:underline dark:text-blue-400">
          Settings → Export
        </Link>{" "}
        to copy them to another browser.
      </p>
    </div>
  );
}
