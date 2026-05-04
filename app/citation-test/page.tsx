"use client";

import { useState } from "react";
import { extractCitations, type ExtractedCitation } from "@/lib/citations/extract";

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; found: boolean; text?: string; reason?: string; url?: string | null; actCode?: string | null }
  | { status: "error"; error: string };

const SAMPLE_TEXT = `Under the Employment Standards Act, 2000, section 14(2) requires employers to maintain employment records for at least three years.

Pursuant to s. 96(1) of the Labour Relations Act, 1995, an employee may file a complaint within 90 days.

The Human Rights Code prohibits discrimination on enumerated grounds (see section 5).

Under section 4 of the Limitations Act, 2002, the basic limitation period is two years.`;

export default function CitationTestPage() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [citations, setCitations] = useState<ExtractedCitation[]>([]);
  const [lookups, setLookups] = useState<Record<number, LookupState>>({});

  function handleExtract() {
    const result = extractCitations(text);
    setCitations(result);
    setLookups({});
  }

  async function handleLookup(idx: number, c: ExtractedCitation) {
    setLookups((s) => ({ ...s, [idx]: { status: "loading" } }));
    try {
      const res = await fetch("/api/lookup-legislation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jurisdiction: "ontario",
          act: c.act,
          section: c.section,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setLookups((s) => ({ ...s, [idx]: { status: "error", error: json.error } }));
        return;
      }
      setLookups((s) => ({
        ...s,
        [idx]: {
          status: "ok",
          found: json.found,
          text: json.text,
          reason: json.reason,
          url: json.url,
          actCode: json.actCode,
        },
      }));
    } catch (err) {
      setLookups((s) => ({
        ...s,
        [idx]: { status: "error", error: err instanceof Error ? err.message : String(err) },
      }));
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Citation extractor — test bench
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Paste a legal answer and extract Ontario legislation citations, then fetch
          the actual section text live from e-Laws (ontario.ca/laws). Internal test page.
        </p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">
          Text to scan
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
            onClick={() => {
              setText(SAMPLE_TEXT);
              setCitations([]);
              setLookups({});
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            Reset to sample
          </button>
        </div>
      </section>

      {citations.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Found {citations.length} citation{citations.length === 1 ? "" : "s"}
          </h2>
          {citations.map((c, idx) => {
            const lookup = lookups[idx] ?? { status: "idle" };
            return (
              <div
                key={idx}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {c.act}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                      Section <span className="font-mono">{c.section}</span> · {c.jurisdiction}
                    </div>
                  </div>
                  <button
                    onClick={() => handleLookup(idx, c)}
                    disabled={lookup.status === "loading"}
                    className="rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                  >
                    {lookup.status === "loading" ? "Fetching…" : "Look up live"}
                  </button>
                </div>

                <div className="mt-2 rounded bg-slate-50 p-2 text-[11px] italic text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                  Context: {c.context}
                </div>

                {lookup.status === "ok" && lookup.found && (
                  <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                        ✓ Section text retrieved (act code: {lookup.actCode})
                      </span>
                      {lookup.url && (
                        <a
                          href={lookup.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-emerald-700 underline dark:text-emerald-400"
                        >
                          View on e-Laws ↗
                        </a>
                      )}
                    </div>
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-slate-800 dark:text-slate-200">
                      {lookup.text}
                    </pre>
                  </div>
                )}

                {lookup.status === "ok" && !lookup.found && (
                  <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                    <div className="font-medium">⚠ Section not found</div>
                    <div className="mt-1">{lookup.reason}</div>
                    {lookup.url && (
                      <a
                        href={lookup.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block underline"
                      >
                        View act on e-Laws ↗
                      </a>
                    )}
                  </div>
                )}

                {lookup.status === "error" && (
                  <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                    Error: {lookup.error}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {citations.length === 0 && text && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Click &ldquo;Extract citations&rdquo; to scan the text above.
        </p>
      )}
    </div>
  );
}
