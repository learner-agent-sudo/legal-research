"use client";

import { useEffect, useState } from "react";
import { ProviderPings } from "@/components/ProviderPings";

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
      setData((await res.json()) as SelfTestResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { runSelfTest(); }, []);

  return (
    <div className="space-y-4 sm:space-y-6">
      <header>
        <h1 className="text-lg font-semibold text-slate-900 sm:text-xl dark:text-slate-100">
          Diagnostics
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Library self-test, environment info, and provider connectivity.
        </p>
      </header>

      {/* ── Library self-test ─────────────────────────────────────────── */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Library self-test
          </h2>
          <button
            onClick={runSelfTest}
            disabled={loading}
            className="shrink-0 rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
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
            <ul className="mt-3 space-y-1.5">
              {data.checks.map((c, i) => (
                <li key={i} className="flex flex-col gap-0.5 rounded-md border border-slate-100 px-3 py-2 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        c.status === "pass"
                          ? "shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-800 dark:bg-green-950 dark:text-green-300"
                          : "shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800 dark:bg-red-950 dark:text-red-300"
                      }
                    >
                      {c.status === "pass" ? "PASS" : "FAIL"}
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-300">
                      {c.name}
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">{c.ms}ms</span>
                  </div>
                  {c.detail && (
                    <p className="pl-1 text-xs text-red-600 dark:text-red-400 break-words">
                      {c.detail}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {loading && !data && (
          <div className="py-6 text-center text-sm text-slate-400">Running checks…</div>
        )}
      </section>

      {/* ── Provider connectivity ──────────────────────────────────────── */}
      <ProviderPings />

      {/* ── Environment ───────────────────────────────────────────────── */}
      {data && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Environment
          </h2>
          <dl className="space-y-0.5 text-sm">
            <EnvRow label="Node version"     value={data.env.nodeVersion} />
            <EnvRow label="Vercel env"       value={data.env.vercelEnv ?? "—"} />
            <EnvRow label="Branch"           value={data.env.vercelGitCommitRef ?? "—"} />
            <EnvRow label="Commit"           value={data.env.vercelGitCommitSha ?? "—"} mono />
            <EnvRow label="Vercel URL"       value={data.env.vercelUrl ?? "—"} mono />
            <EnvRow label="SESSION_SECRET"   value={data.env.sessionSecretConfigured ? "set ✓" : "fallback (set it in Vercel)"} warn={!data.env.sessionSecretConfigured} />
            <EnvRow label="Upstash KV"       value={data.env.upstashConfigured ? "configured ✓" : "not configured"} />
          </dl>
          <p className="mt-3 text-xs text-slate-400">
            Last run: {new Date(data.timestamp).toLocaleString()}
          </p>
        </section>
      )}
    </div>
  );
}

function SummaryBadge({ summary }: { summary: SelfTestResponse["summary"] }) {
  const allPassed = summary.failed === 0;
  return (
    <div
      className={`rounded border px-3 py-2 text-sm ${
        allPassed
          ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
          : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
      }`}
    >
      <strong>{summary.passed}</strong> / {summary.total} checks passed
      {summary.failed > 0 && <> — <strong>{summary.failed}</strong> failed</>}
    </div>
  );
}

function EnvRow({
  label,
  value,
  mono = false,
  warn = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-slate-100 py-1.5 dark:border-slate-800">
      <dt className="shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
      <dd
        className={[
          "min-w-0 break-all text-right",
          mono ? "font-mono text-xs" : "",
          warn
            ? "text-amber-600 dark:text-amber-400"
            : "text-slate-700 dark:text-slate-300",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}
