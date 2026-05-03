"use client";

import { useMemo, useState } from "react";
import {
  buildRefinementPrompt,
  type RefinementCritique,
} from "@/lib/prompts";
import { useToast } from "@/components/Toast";

export type RefineResult = {
  modelId: string;
  modelLabel: string;
  text: string;
  verdict: "green" | "yellow" | "red" | "none";
};

export type RefineAdjudication = {
  challengerId: string;
  adjudicatorLabel: string;
  verdict: "green" | "yellow" | "red" | "none";
  text: string;
};

export function RefinePanel({
  userQuestion,
  claudeAnswer,
  results,
  adjudications,
}: {
  userQuestion: string;
  claudeAnswer: string;
  results: RefineResult[];
  adjudications: RefineAdjudication[];
}) {
  const toast = useToast();
  const [selfContained, setSelfContained] = useState(false);
  const [edited, setEdited] = useState<string | null>(null);

  const concerns = useMemo<RefinementCritique[]>(() => {
    return results
      .filter((r) => r.verdict === "red" || r.verdict === "yellow")
      .map((r) => ({
        modelLabel: r.modelLabel,
        verdict: r.verdict as "red" | "yellow",
        critique: r.text.replace(/^\[(GREEN|YELLOW|RED)\]\s*/i, ""),
        adjudications: adjudications
          .filter((a) => a.challengerId === r.modelId)
          .map((a) => ({
            adjudicatorLabel: a.adjudicatorLabel,
            verdict: a.verdict,
            summary: a.text.replace(/^\[(GREEN|YELLOW|RED)\]\s*/i, ""),
          })),
      }));
  }, [results, adjudications]);

  const generatedPrompt = useMemo(
    () =>
      buildRefinementPrompt({
        userQuestion,
        claudeAnswer,
        critiques: concerns,
        selfContained,
      }),
    [userQuestion, claudeAnswer, concerns, selfContained]
  );

  const promptToCopy = edited ?? generatedPrompt;

  if (concerns.length === 0) return null;

  async function handleCopyAndOpen() {
    try {
      await navigator.clipboard.writeText(promptToCopy);
      toast.show("success", "Prompt copied. Opening Claude…");
    } catch {
      toast.show("warn", "Could not copy automatically — copy manually below.");
    }
    window.open("https://claude.ai/", "_blank", "noreferrer");
  }

  async function handleCopyOnly() {
    try {
      await navigator.clipboard.writeText(promptToCopy);
      toast.show("success", "Prompt copied to clipboard.");
    } catch {
      toast.show("error", "Clipboard not available — select the text manually.");
    }
  }

  const redCount = concerns.filter((c) => c.verdict === "red").length;
  const yellowCount = concerns.filter((c) => c.verdict === "yellow").length;

  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/30 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Refine with Claude
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Send the {redCount > 0 && `${redCount} major`}
            {redCount > 0 && yellowCount > 0 && " + "}
            {yellowCount > 0 && `${yellowCount} minor`} concern{concerns.length === 1 ? "" : "s"} back to Claude as a follow-up so it can revise its answer.
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={selfContained}
            onChange={(e) => {
              setSelfContained(e.target.checked);
              setEdited(null);
            }}
            className="h-3.5 w-3.5"
          />
          Include original Q&amp;A (for a fresh conversation)
        </label>
      </div>

      <details className="mt-3 rounded-lg border border-blue-200 bg-white dark:border-blue-900/50 dark:bg-slate-900">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300">
          Preview & edit prompt ({promptToCopy.length.toLocaleString()} chars)
        </summary>
        <textarea
          value={promptToCopy}
          onChange={(e) => setEdited(e.target.value)}
          rows={12}
          className="block w-full resize-y rounded-b-lg border-t border-slate-200 bg-white p-3 font-mono text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        />
        {edited !== null && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
            <span>Edited from generated prompt.</span>
            <button
              onClick={() => setEdited(null)}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Reset
            </button>
          </div>
        )}
      </details>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={handleCopyAndOpen}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          Copy prompt &amp; open Claude
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M11 3a1 1 0 1 0 0 2h2.6l-5.3 5.3a1 1 0 0 0 1.4 1.4L15 6.4V9a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-5Z" />
            <path d="M5 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a1 1 0 1 0-2 0v3H5V7h3a1 1 0 1 0 0-2H5Z" />
          </svg>
        </button>
        <button
          onClick={handleCopyOnly}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Copy only
        </button>
      </div>

      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        Tip: paste this into the same Claude conversation you started — Claude will see it as a follow-up and revise.
        {!selfContained &&
          " Switch on “Include original Q&A” if you're starting a fresh chat instead."}
      </p>
    </section>
  );
}
