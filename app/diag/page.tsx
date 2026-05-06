"use client";

import { useEffect, useState } from "react";

type Check = {
  name: string;
  status: "pass" | "fail";
  detail?: string;
  ms: number;
};

type SelfTestResponse = {
  timestamp: string;
  summary: { total: number; passed: number; failed: number };
  checks: Check[];
  env: {
    nodeVersion: string;
    vercelEnv: string | null;
    vercelUrl: string | null;
    vercelGitCommitSha: string | null;
    vercelGitCommitRef: string | null;
    sessionSecretConfigured: boolean;
    upstashConfigured: boolean;
  };
};

export default function DiagPage() {
  const [data, setData] = useState<SelfTestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSelfTest() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/diag/self-test", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as SelfTestResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runSelfTest();
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Diagnostics
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Self-test of the citation library and environment. Provider connectivity
          checks come in a later release.
        </p>
      </header>

      {/* ── Self-test ─────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Library self-test
          </h2>
          <button
            onClick={runSelfTest}
            disabled={loading}
            className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {loading ? "Running…" : "Re-run"}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">Error: {error}</p>
        )}

        {data && (
          <>
            <SummaryBadge summary={data.summary} />
            <ul className="mt-3 space-y-1">
              {data.checks.map((c, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm"
                >
                  <span
                    className={
                      c.status === "pass"
                        ? "shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-800 dark:bg-green-950 dark:text-green-300"
                        : "shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800 dark:bg-red-950 dark:text-red-300"
                    }
                  >
                    {c.status.toUpperCase()}
                  </span>
                  <span className="flex-1 text-slate-700 dark:text-slate-300">
                    {c.name}
                    {c.detail && (
                      <span className="ml-2 text-xs text-red-600 dark:text-red-400">
                        — {c.detail}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {c.ms}ms
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ── Environment ───────────────────────────────────────────────── */}
      {data && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Environment
          </h2>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            <Row label="Node version" value={data.env.nodeVersion} />
            <Row label="Vercel env" value={data.env.vercelEnv ?? "—"} />
            <Row label="Branch" value={data.env.vercelGitCommitRef ?? "—"} />
            <Row label="Commit" value={data.env.vercelGitCommitSha ?? "—"} mono />
            <Row label="Vercel URL" value={data.env.vercelUrl ?? "—"} mono />
            <Row
              label="SESSION_SECRET"
              value={data.env.sessionSecretConfigured ? "set" : "fallback"}
            />
            <Row
              label="Upstash KV"
              value={data.env.upstashConfigured ? "configured" : "not configured"}
            />
          </dl>
          <p className="mt-3 text-xs text-slate-400">
            Last run: {new Date(data.timestamp).toLocaleString()}
          </p>
        </section>
      )}

      {/* ── Provider checks (Piece 5 placeholder) ─────────────────────── */}
      <section className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
        <h2 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Provider connectivity (coming soon)
        </h2>
        <p>
          A future release will ping each configured AI provider (OpenRouter, Groq,
          Gemini, Mistral, etc.) using your stored API key and report latency and
          status. Today this section is a placeholder.
        </p>
      </section>
    </div>
  );
}

function SummaryBadge({ summary }: { summary: SelfTestResponse["summary"] }) {
  const allPassed = summary.failed === 0;
  return (
    <div
      className={
        allPassed
          ? "rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
          : "rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
      }
    >
      <strong>{summary.passed}</strong> / {summary.total} checks passed
      {summary.failed > 0 && <> — {summary.failed} failed</>}
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2 border-b border-slate-100 py-1 dark:border-slate-800">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd
        className={
          mono
            ? "truncate font-mono text-xs text-slate-700 dark:text-slate-300"
            : "truncate text-slate-700 dark:text-slate-300"
        }
      >
        {value}
      </dd>
    </div>
  );
}
