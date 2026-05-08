"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ConsolidationCritique } from "@/lib/prompts";

const VERDICT_CHIP: Record<"red" | "yellow", { chip: string; label: string; border: string }> = {
  red: {
    chip: "bg-rose-200 text-rose-900 dark:bg-rose-900/60 dark:text-rose-200",
    label: "Major issues",
    border: "border-rose-200 dark:border-rose-800/40",
  },
  yellow: {
    chip: "bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200",
    label: "Some concerns",
    border: "border-amber-200 dark:border-amber-800/40",
  },
};

export function AmberSummaryPanel({ critiques }: { critiques: ConsolidationCritique[] }) {
  // Start with the first card open so users immediately see the concerns
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  if (critiques.length === 0) return null;

  const redCount = critiques.filter((c) => c.verdict === "red").length;
  const yellowCount = critiques.filter((c) => c.verdict === "yellow").length;

  const summary = [
    redCount > 0 && `${redCount} major`,
    yellowCount > 0 && `${yellowCount} cautious`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 shadow-sm dark:border-amber-800/50 dark:bg-amber-950/20 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
          Concerns raised
        </h3>
        <span className="text-xs text-amber-700 dark:text-amber-400">
          ({summary})
        </span>
      </div>

      <div className="space-y-2">
        {critiques.map((c, i) => {
          const chip = VERDICT_CHIP[c.verdict];
          const isOpen = openIdx === i;
          return (
            <div
              key={i}
              className={`rounded-lg border bg-white dark:bg-slate-900 ${chip.border}`}
            >
              <button
                onClick={() => setOpenIdx(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                aria-expanded={isOpen}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${chip.chip}`}>
                    {chip.label}
                  </span>
                  <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {c.modelLabel}
                  </span>
                </div>
                <span className="shrink-0 text-slate-400 dark:text-slate-500">
                  {isOpen ? "▾" : "▸"}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-slate-100 px-3 pb-3 pt-2 dark:border-slate-800">
                  <div className="prose prose-sm max-w-none overflow-x-auto break-words dark:prose-invert prose-headings:mt-3 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.body}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
