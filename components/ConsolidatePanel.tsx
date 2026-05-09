"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  buildConsolidationPrompt,
  type ConsolidationCritique,
} from "@/lib/prompts";
import type { ModelPreset } from "@/lib/presets";

/**
 * Effective-throughput estimate per model. Higher = safer for big prompts.
 * Groq's free tier has a ~12K tokens-per-minute cap regardless of nominal
 * context length, so we penalise it heavily.
 */
function estimatedThroughput(m: ModelPreset): number {
  if (m.contextLength && m.contextLength > 0) {
    return m.provider === "groq" ? Math.min(m.contextLength, 8_000) : m.contextLength;
  }
  if (m.kind === "gemini") return 1_000_000;
  if (m.provider === "mistral") return 32_000;
  if (m.provider === "openrouter") return 32_000;
  if (m.provider === "groq") return 8_000;
  return 4_000;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

type Verdict = "critical" | "moderate" | "minor" | "none";

function parseConsolidationVerdict(text: string): { verdict: Verdict; body: string } {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i].trim().toUpperCase();
    if (line.startsWith("[CRITICAL]")) return { verdict: "critical", body: lines.slice(i + 1).join("\n").trimStart() };
    if (line.startsWith("[MODERATE]")) return { verdict: "moderate", body: lines.slice(i + 1).join("\n").trimStart() };
    if (line.startsWith("[MINOR]"))    return { verdict: "minor",    body: lines.slice(i + 1).join("\n").trimStart() };
  }
  return { verdict: "none", body: text };
}

const VERDICT_STYLES: Record<Verdict, { card: string; chip: string; label: string }> = {
  critical: {
    card: "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30",
    chip: "bg-rose-200 text-rose-900 dark:bg-rose-900/60 dark:text-rose-200",
    label: "Critical issues",
  },
  moderate: {
    card: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
    chip: "bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200",
    label: "Moderate concerns",
  },
  minor: {
    card: "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30",
    chip: "bg-emerald-200 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200",
    label: "Minor / largely sound",
  },
  none: {
    card: "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
    chip: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    label: "",
  },
};

export type ConsolidatePanelProps = {
  critiques: ConsolidationCritique[];      // pre-filtered red+yellow
  claudeAnswer: string;
  documentText: string;
  userQuestion: string;
  availableModels: ModelPreset[];          // models the user can pick from (with API keys)
  apiKeys: Record<string, string>;
};

export function ConsolidatePanel(props: ConsolidatePanelProps) {
  const { critiques, claudeAnswer, documentText, userQuestion, availableModels, apiKeys } = props;

  // Sort eligible models by estimated throughput (largest first) so the
  // default pick is the one most likely to handle big prompts.
  const eligibleModels = useMemo(
    () =>
      availableModels
        .filter(
          (m) =>
            (m.kind === "openai-compat" || m.kind === "gemini") &&
            Boolean(apiKeys[m.provider]?.trim())
        )
        .sort((a, b) => estimatedThroughput(b) - estimatedThroughput(a)),
    [availableModels, apiKeys]
  );

  const [selectedModelId, setSelectedModelId] = useState<string>(
    eligibleModels[0]?.id ?? ""
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [resultModelLabel, setResultModelLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estimate prompt size so the user sees ahead of time if they're flirting
  // with the selected model's per-minute cap.
  const estimatedPromptTokens = useMemo(() => {
    if (critiques.length === 0) return 0;
    const prompt = buildConsolidationPrompt({
      claudeAnswer,
      documentText,
      userQuestion,
      critiques,
    });
    return estimateTokens(prompt);
  }, [claudeAnswer, documentText, userQuestion, critiques]);

  const selectedModel = eligibleModels.find((m) => m.id === selectedModelId);
  const selectedCap = selectedModel ? estimatedThroughput(selectedModel) : 0;
  const tooBig = selectedCap > 0 && estimatedPromptTokens > selectedCap;

  if (critiques.length === 0) return null;

  async function runConsolidation() {
    const model = eligibleModels.find((m) => m.id === selectedModelId);
    if (!model) {
      setError("Select a model first.");
      return;
    }
    const apiKey = apiKeys[model.provider];
    if (!apiKey?.trim()) {
      setError(`No API key for ${model.provider}. Add one in Settings.`);
      return;
    }

    setRunning(true);
    setError(null);
    setResult(null);
    setResultModelLabel(null);

    try {
      const prompt = buildConsolidationPrompt({
        claudeAnswer,
        documentText,
        userQuestion,
        critiques,
      });
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: model.kind,
          baseUrl: model.baseUrl,
          modelId: model.modelId,
          apiKey,
          prompt,
        }),
      });
      const json = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setResult(json.text ?? "");
      setResultModelLabel(model.label);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const parsed = result ? parseConsolidationVerdict(result) : null;
  const style = parsed ? VERDICT_STYLES[parsed.verdict] : null;

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 shadow-sm dark:border-indigo-800/50 dark:bg-indigo-950/20 sm:p-4">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="rounded bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
          ✦ AI synthesis
        </span>
        <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
          Synthesise concerns with AI
        </h3>
      </div>
      <p className="mb-3 text-xs text-indigo-700/70 dark:text-indigo-400/80">
        Ask a model to merge the {critiques.length} flagged concern{critiques.length === 1 ? "" : "s"} into one themed report.
        This is a <strong>new AI-generated output</strong> — not one of the original model responses above.
      </p>

      {/* Model picker + button — stacks on mobile */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={selectedModelId}
          onChange={(e) => setSelectedModelId(e.target.value)}
          disabled={running || eligibleModels.length === 0}
          className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          {eligibleModels.length === 0 ? (
            <option value="">No models with API keys configured</option>
          ) : (
            eligibleModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))
          )}
        </select>
        <button
          onClick={runConsolidation}
          disabled={running || eligibleModels.length === 0}
          className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {running ? "Synthesising…" : "Consolidate"}
        </button>
      </div>

      {eligibleModels.length > 0 && (
        <p className={`mt-2 text-[11px] ${tooBig ? "text-rose-700 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}`}>
          ~{estimatedPromptTokens.toLocaleString()} tokens to send
          {selectedCap > 0 && (
            <> · this model&apos;s effective limit ≈{selectedCap.toLocaleString()}</>
          )}
          {tooBig && (
            <> — pick a higher-context model{eligibleModels[0]?.kind === "gemini" ? " (Gemini handles ~1M tokens)" : ""}</>
          )}
        </p>
      )}

      {error && (
        <p className="mt-3 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {parsed && style && (
        <div className="mt-3 rounded-lg border border-indigo-200 bg-white dark:border-indigo-800/40 dark:bg-slate-900">
          {/* Attribution bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 px-3 py-2 dark:border-indigo-900/40">
            <div className="flex items-center gap-2">
              <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:bg-indigo-900/60 dark:text-indigo-300">
                ✦ AI generated
              </span>
              {resultModelLabel && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  by {resultModelLabel}
                </span>
              )}
            </div>
            {parsed.verdict !== "none" && (
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${style.chip}`}>
                {style.label}
              </span>
            )}
          </div>
          <div className="p-3">
            <div className="prose prose-sm max-w-none overflow-x-auto break-words dark:prose-invert prose-headings:mt-3 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsed.body}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
