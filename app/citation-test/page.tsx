"use client";

import { useState } from "react";
import {
  extractCitations,
  extractCaseCitations,
  type ExtractedCitation,
  type ExtractedCaseCitation,
} from "@/lib/citations/extract";

// ── Types ──────────────────────────────────────────────────────────────────

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "fetched"; sectionText: string; url: string; actCode: string }
  | { status: "not-found"; reason: string; url: string | null; debug?: { plainTextSample: string; htmlLength: number; plainTextLength: number } }
  | { status: "error"; error: string };

type VerifyState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; verdict: string; explanation: string }
  | { status: "error"; error: string };

type CanLIIHit = { title: string; citation: string; url: string };

type CanLIIState =
  | { status: "loading" }
  | { status: "ok"; hits: CanLIIHit[] }
  | { status: "error"; message: string };

type ModelPreset = {
  label: string;
  kind: "openai-compat" | "gemini";
  baseUrl?: string;
  modelId: string;
  storageKey: string; // localStorage key for the API key
};

const MODEL_PRESETS: ModelPreset[] = [
  {
    label: "Llama 3.3 70B (Groq, free)",
    kind: "openai-compat",
    baseUrl: "https://api.groq.com/openai/v1",
    modelId: "llama-3.3-70b-versatile",
    storageKey: "lr.groq",
  },
  {
    label: "Gemini 2.0 Flash (Google, free)",
    kind: "gemini",
    modelId: "gemini-2.0-flash",
    storageKey: "lr.gemini",
  },
  {
    label: "Mistral Small (Mistral, free)",
    kind: "openai-compat",
    baseUrl: "https://api.mistral.ai/v1",
    modelId: "mistral-small-latest",
    storageKey: "lr.mistral",
  },
  {
    label: "Meta Llama 4 Scout (OpenRouter, free)",
    kind: "openai-compat",
    baseUrl: "https://openrouter.ai/api/v1",
    modelId: "meta-llama/llama-4-scout:free",
    storageKey: "lr.openrouter",
  },
];

const VERDICT_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  accurate:     { label: "✓ Accurate",      bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-800 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-900/50" },
  partial:      { label: "⚠ Partial",       bg: "bg-amber-50 dark:bg-amber-950/30",     text: "text-amber-800 dark:text-amber-300",   border: "border-amber-200 dark:border-amber-900/50" },
  wrong:        { label: "✗ Wrong",          bg: "bg-rose-50 dark:bg-rose-950/30",       text: "text-rose-800 dark:text-rose-300",     border: "border-rose-200 dark:border-rose-900/50" },
  unverifiable: { label: "? Unverifiable",   bg: "bg-slate-50 dark:bg-slate-900",        text: "text-slate-700 dark:text-slate-300",   border: "border-slate-200 dark:border-slate-700" },
  "not-found":  { label: "– Not found",      bg: "bg-slate-50 dark:bg-slate-900",        text: "text-slate-500 dark:text-slate-400",   border: "border-slate-200 dark:border-slate-700" },
};

const SAMPLE_TEXT = `Under the Employment Standards Act, 2000, section 14(2) requires employers to maintain employment records for at least three years.

Pursuant to s. 96(1) of the Labour Relations Act, 1995, an employee may file a complaint within 90 days.

The Human Rights Code prohibits discrimination on enumerated grounds (see section 5).

Under section 4 of the Limitations Act, 2002, the basic limitation period is two years.

In Honda Canada Inc. v. Keays, 2008 SCC 39, the Supreme Court rejected Wallace damages.

See also Bhasin v Hrynew, 2014 SCC 71, on the duty of honest performance.

The classic English authority is Donoghue v Stevenson [1932] AC 562.`;

// ── Component ──────────────────────────────────────────────────────────────

export default function CitationTestPage() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [citations, setCitations] = useState<ExtractedCitation[]>([]);
  const [caseCitations, setCaseCitations] = useState<ExtractedCaseCitation[]>([]);
  const [lookups, setLookups] = useState<Record<number, LookupState>>({});
  const [verifies, setVerifies] = useState<Record<number, VerifyState>>({});
  const [selectedModel, setSelectedModel] = useState(0);
  // Manually-pasted section text per-citation (fallback when live fetch fails)
  const [manualText, setManualText] = useState<Record<number, string>>({});
  // CanLII search state per-citation (independent of the main lookup)
  const [canliiState, setCanliiState] = useState<Record<number, CanLIIState>>({});
  // CanLII search state for case citations (separate index space)
  const [caseCanliiState, setCaseCanliiState] = useState<Record<number, CanLIIState>>({});

  async function handleCaseCanLIISearch(idx: number, c: ExtractedCaseCitation) {
    const apiKey =
      typeof window !== "undefined"
        ? (() => {
            try {
              const raw = window.localStorage.getItem("lr.apiKeys.v1");
              const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
              return map.canlii?.trim() ?? "";
            } catch {
              return "";
            }
          })()
        : "";

    if (!apiKey) {
      setCaseCanliiState((s) => ({
        ...s,
        [idx]: { status: "error", message: "No CanLII API key — add one in Settings." },
      }));
      return;
    }

    setCaseCanliiState((s) => ({ ...s, [idx]: { status: "loading" } }));

    try {
      const res = await fetch("/api/canlii/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "case",
          query: c.caseName,
          apiKey,
        }),
      });
      const json = (await res.json()) as
        | { ok: true; hits: { title: string; citation: string; url: string }[] }
        | { ok: false; errorKind?: string; message?: string; error?: string };

      if (!json.ok) {
        setCaseCanliiState((s) => ({
          ...s,
          [idx]: { status: "error", message: json.message ?? json.error ?? "CanLII lookup failed." },
        }));
        return;
      }
      setCaseCanliiState((s) => ({ ...s, [idx]: { status: "ok", hits: json.hits } }));
    } catch (err) {
      setCaseCanliiState((s) => ({
        ...s,
        [idx]: { status: "error", message: err instanceof Error ? err.message : String(err) },
      }));
    }
  }

  async function handleCanLIISearch(idx: number, c: ExtractedCitation) {
    const apiKey =
      typeof window !== "undefined"
        ? (() => {
            try {
              const raw = window.localStorage.getItem("lr.apiKeys.v1");
              const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
              return map.canlii?.trim() ?? "";
            } catch {
              return "";
            }
          })()
        : "";

    if (!apiKey) {
      setCanliiState((s) => ({
        ...s,
        [idx]: { status: "error", message: "No CanLII API key — add one in Settings." },
      }));
      return;
    }

    setCanliiState((s) => ({ ...s, [idx]: { status: "loading" } }));

    try {
      const res = await fetch("/api/canlii/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "legislation",
          query: c.act,
          jurisdiction: "ontario",
          apiKey,
        }),
      });
      const json = (await res.json()) as
        | { ok: true; hits: { title: string; citation: string; url: string }[]; totalCount: number }
        | { ok: false; errorKind?: string; message?: string; error?: string };

      if (!json.ok) {
        setCanliiState((s) => ({
          ...s,
          [idx]: { status: "error", message: json.message ?? json.error ?? "CanLII lookup failed." },
        }));
        return;
      }
      setCanliiState((s) => ({ ...s, [idx]: { status: "ok", hits: json.hits } }));
    } catch (err) {
      setCanliiState((s) => ({
        ...s,
        [idx]: { status: "error", message: err instanceof Error ? err.message : String(err) },
      }));
    }
  }

  function handleExtract() {
    setCitations(extractCitations(text));
    setCaseCitations(extractCaseCitations(text));
    setLookups({});
    setVerifies({});
    setCanliiState({});
    setCaseCanliiState({});
  }

  async function handleLookup(idx: number, c: ExtractedCitation) {
    setLookups((s) => ({ ...s, [idx]: { status: "loading" } }));
    setVerifies((s) => ({ ...s, [idx]: { status: "idle" } }));
    try {
      const res = await fetch("/api/lookup-legislation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jurisdiction: "ontario", act: c.act, section: c.section }),
      });
      const json = await res.json();
      if (!json.ok) {
        setLookups((s) => ({ ...s, [idx]: { status: "error", error: json.error } }));
        return;
      }
      if (!json.found) {
        setLookups((s) => ({ ...s, [idx]: { status: "not-found", reason: json.reason, url: json.url, debug: json.debug } }));
        return;
      }
      setLookups((s) => ({
        ...s,
        [idx]: { status: "fetched", sectionText: json.text, url: json.url, actCode: json.actCode },
      }));
    } catch (err) {
      setLookups((s) => ({
        ...s,
        [idx]: { status: "error", error: err instanceof Error ? err.message : String(err) },
      }));
    }
  }

  async function handleVerify(idx: number, c: ExtractedCitation) {
    const lookup = lookups[idx];
    const manual = manualText[idx]?.trim();

    // Allow verification with either fetched text OR manually-pasted text
    const hasFetched = lookup?.status === "fetched";
    const hasManual = manual && manual.length > 20;
    if (!hasFetched && !hasManual) return;

    const preset = MODEL_PRESETS[selectedModel];
    const apiKey = typeof window !== "undefined"
      ? localStorage.getItem(preset.storageKey) ?? undefined
      : undefined;

    const actCode =
      lookup?.status === "fetched" ? lookup.actCode : undefined;

    setVerifies((s) => ({ ...s, [idx]: { status: "loading" } }));
    try {
      const res = await fetch("/api/verify-citation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jurisdiction: "ontario",
          act: c.act,
          section: c.section,
          actCode,
          claudeClaim: c.context,
          manualSectionText: hasManual ? manual : undefined,
          model: {
            kind: preset.kind,
            baseUrl: preset.baseUrl,
            modelId: preset.modelId,
            apiKey,
          },
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setVerifies((s) => ({ ...s, [idx]: { status: "error", error: json.error } }));
        return;
      }
      setVerifies((s) => ({
        ...s,
        [idx]: { status: "done", verdict: json.verdict, explanation: json.explanation },
      }));
    } catch (err) {
      setVerifies((s) => ({
        ...s,
        [idx]: { status: "error", error: err instanceof Error ? err.message : String(err) },
      }));
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Citation checker — test bench
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Paste a legal answer → extract Ontario citations → fetch live section text from e-Laws →
          have an AI model judge whether Claude&apos;s claim matches.
        </p>
      </header>

      {/* Model selector */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
          AI model for verification
        </label>
        <div className="flex flex-wrap gap-2">
          {MODEL_PRESETS.map((m, i) => (
            <button
              key={i}
              onClick={() => setSelectedModel(i)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                selectedModel === i
                  ? "border-blue-500 bg-blue-600 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          API key is read from your browser&apos;s Settings page (same keys used for verification). No key? Add it on the{" "}
          <a href="/settings" className="underline">Settings page</a>.
        </p>
      </section>

      {/* Text input */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">
          Legal answer to scan
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          className="mt-2 block w-full rounded-md border border-slate-300 bg-white p-3 font-mono text-xs text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleExtract}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            Extract citations
          </button>
          <button
            onClick={() => { setText(SAMPLE_TEXT); setCitations([]); setLookups({}); setVerifies({}); }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            Reset to sample
          </button>
        </div>
      </section>

      {/* Results */}
      {citations.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {citations.length} citation{citations.length === 1 ? "" : "s"} found
          </h2>
          {citations.map((c, idx) => {
            const lookup = lookups[idx] ?? { status: "idle" };
            const verify = verifies[idx] ?? { status: "idle" };
            const vc = verify.status === "done" ? VERDICT_CONFIG[verify.verdict] : null;

            return (
              <div key={idx} className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                {/* Header */}
                <div className="flex flex-wrap items-baseline justify-between gap-2 p-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{c.act}</div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Section <span className="font-mono">{c.section}</span> · Ontario
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleLookup(idx, c)}
                      disabled={lookup.status === "loading"}
                      className="rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                    >
                      {lookup.status === "loading" ? "Fetching…" : "1. Fetch live text"}
                    </button>
                    <button
                      onClick={() => handleCanLIISearch(idx, c)}
                      disabled={canliiState[idx]?.status === "loading"}
                      className="rounded-md border border-teal-300 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-60 dark:border-teal-700 dark:bg-teal-950/50 dark:text-teal-300"
                    >
                      {canliiState[idx]?.status === "loading" ? "Searching CanLII…" : "Search CanLII"}
                    </button>
                    {lookup.status === "fetched" && (
                      <button
                        onClick={() => handleVerify(idx, c)}
                        disabled={verify.status === "loading"}
                        className="rounded-md border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-60 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
                      >
                        {verify.status === "loading" ? "Verifying…" : "2. Verify with AI"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Context */}
                <div className="border-t border-slate-100 px-4 py-2 dark:border-slate-800">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Claude&apos;s claim</span>
                  <p className="mt-0.5 text-xs italic text-slate-600 dark:text-slate-400">{c.context}</p>
                </div>

                {/* CanLII results — shown whenever a search has been run */}
                {canliiState[idx] && (
                  <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">CanLII results</span>
                    {canliiState[idx]?.status === "loading" && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Searching CanLII…</p>
                    )}
                    {canliiState[idx]?.status === "error" && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                        ⚠ {(canliiState[idx] as { status: "error"; message: string }).message}
                      </p>
                    )}
                    {canliiState[idx]?.status === "ok" && (() => {
                      const hits = (canliiState[idx] as { status: "ok"; hits: CanLIIHit[] }).hits;
                      return hits.length === 0 ? (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">No matching legislation found on CanLII.</p>
                      ) : (
                        <ul className="mt-1.5 space-y-1">
                          {hits.slice(0, 5).map((h, i) => (
                            <li key={i} className="text-[11px]">
                              <a
                                href={h.url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-blue-700 underline hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                {h.title}
                              </a>
                              {h.citation && (
                                <span className="ml-1 text-slate-500 dark:text-slate-400">· {h.citation}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      );
                    })()}
                  </div>
                )}

                {/* Lookup result */}
                {lookup.status === "fetched" && (
                  <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        Live section text
                        <span className="ml-1.5 rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                          fetched
                        </span>
                      </span>
                      <a href={lookup.url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 underline dark:text-blue-400">
                        View on e-Laws ↗
                      </a>
                    </div>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                      {lookup.sectionText}
                    </pre>
                  </div>
                )}

                {lookup.status === "not-found" && (
                  <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      ⚠ Live fetch unavailable: ontario.ca/laws is a JavaScript-rendered site and can&apos;t be scraped server-side.
                      {lookup.url && (
                        <>
                          {" "}
                          <a href={lookup.url} target="_blank" rel="noreferrer" className="underline font-medium">
                            Open the act on e-Laws ↗
                          </a>
                        </>
                      )}
                    </p>
                    <p className="mt-2 text-xs text-slate-700 dark:text-slate-300">
                      <span className="font-medium">Workaround:</span> open the link above in a new tab, find section{" "}
                      <span className="font-mono">{c.section}</span>, copy the section text, and paste it below. The AI will
                      then compare your pasted text against Claude&apos;s claim.
                    </p>

                    <textarea
                      value={manualText[idx] ?? ""}
                      onChange={(e) => setManualText((s) => ({ ...s, [idx]: e.target.value }))}
                      placeholder={`Paste section ${c.section} text here…`}
                      rows={6}
                      className="mt-2 block w-full rounded-md border border-slate-300 bg-white p-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                    />
                    {(manualText[idx]?.trim().length ?? 0) > 20 && (
                      <button
                        onClick={() => handleVerify(idx, c)}
                        disabled={verify.status === "loading"}
                        className="mt-2 rounded-md border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-60 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
                      >
                        {verify.status === "loading" ? "Verifying…" : "Verify pasted text with AI"}
                      </button>
                    )}
                    {lookup.debug && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[11px] font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-400">
                          Debug ({Math.round(lookup.debug.htmlLength / 1024)} KB HTML / {Math.round(lookup.debug.plainTextLength / 1024)} KB text)
                        </summary>
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-[10px] text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                          {lookup.debug.plainTextSample}
                        </pre>
                      </details>
                    )}
                  </div>
                )}

                {lookup.status === "error" && (
                  <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                    <p className="text-xs text-rose-700 dark:text-rose-400">Error: {lookup.error}</p>
                  </div>
                )}

                {/* AI Verdict */}
                {verify.status === "done" && vc && (
                  <div className={`border-t ${vc.border} mx-4 mb-4 mt-0 rounded-md border ${vc.bg} p-3`}>
                    <div className={`text-xs font-semibold ${vc.text}`}>{vc.label}</div>
                    <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">{verify.explanation}</p>
                  </div>
                )}

                {verify.status === "error" && (
                  <div className="mx-4 mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                    AI error: {verify.error}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Case-law citations */}
      {caseCitations.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {caseCitations.length} case citation{caseCitations.length === 1 ? "" : "s"} found
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Use CanLII to confirm each case is real and that the citation matches the name.
          </p>
          {caseCitations.map((c, idx) => {
            const state = caseCanliiState[idx];
            return (
              <div key={idx} className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-baseline justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{c.caseName}</div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {c.citation ? (
                        <span className="font-mono">{c.citation}</span>
                      ) : (
                        <span className="italic">no citation detected</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCaseCanLIISearch(idx, c)}
                    disabled={state?.status === "loading"}
                    className="rounded-md border border-teal-300 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-60 dark:border-teal-700 dark:bg-teal-950/50 dark:text-teal-300"
                  >
                    {state?.status === "loading" ? "Searching CanLII…" : "Search CanLII"}
                  </button>
                </div>

                <div className="border-t border-slate-100 px-4 py-2 dark:border-slate-800">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Claude&apos;s claim</span>
                  <p className="mt-0.5 text-xs italic text-slate-600 dark:text-slate-400">{c.context}</p>
                </div>

                {state && (
                  <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">CanLII results</span>
                    {state.status === "loading" && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Searching CanLII…</p>
                    )}
                    {state.status === "error" && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">⚠ {state.message}</p>
                    )}
                    {state.status === "ok" && (
                      state.hits.length === 0 ? (
                        <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">
                          No matching case found on CanLII — possibly a hallucinated citation.
                        </p>
                      ) : (
                        <ul className="mt-1.5 space-y-1">
                          {state.hits.slice(0, 5).map((h, i) => (
                            <li key={i} className="text-[11px]">
                              <a
                                href={h.url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-blue-700 underline hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                {h.title}
                              </a>
                              {h.citation && (
                                <span className="ml-1 text-slate-500 dark:text-slate-400">· {h.citation}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
