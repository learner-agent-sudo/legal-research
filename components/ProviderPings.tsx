"use client";

import { useEffect, useState } from "react";
import { loadApiKeys } from "@/lib/storage";

type PingStatus = "idle" | "pinging" | "ok" | "error" | "no-key";

type ProviderResult = {
  provider: string;
  label: string;
  status: PingStatus;
  detail?: string;
  ms?: number;
};

type ProviderDef = {
  provider: string;
  label: string;
  ping: (key: string) => Promise<{ ok: boolean; detail: string; ms: number }>;
};

const PROVIDERS: ProviderDef[] = [
  {
    provider: "groq",
    label: "Groq",
    ping: async (key) => {
      const t0 = Date.now();
      try {
        const res = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(8000),
        });
        const ms = Date.now() - t0;
        if (res.ok) return { ok: true, detail: `${res.status} OK`, ms };
        const body = await res.text().catch(() => "");
        return { ok: false, detail: `HTTP ${res.status} — ${body.slice(0, 120)}`, ms };
      } catch (e) {
        return { ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 };
      }
    },
  },
  {
    provider: "gemini",
    label: "Google Gemini",
    ping: async (key) => {
      const t0 = Date.now();
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        const ms = Date.now() - t0;
        if (res.ok) return { ok: true, detail: `${res.status} OK`, ms };
        const body = await res.json().catch(() => ({}));
        const msg = (body as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`;
        return { ok: false, detail: msg.slice(0, 120), ms };
      } catch (e) {
        return { ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 };
      }
    },
  },
  {
    provider: "mistral",
    label: "Mistral",
    ping: async (key) => {
      const t0 = Date.now();
      try {
        const res = await fetch("https://api.mistral.ai/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(8000),
        });
        const ms = Date.now() - t0;
        if (res.ok) return { ok: true, detail: `${res.status} OK`, ms };
        const body = await res.text().catch(() => "");
        return { ok: false, detail: `HTTP ${res.status} — ${body.slice(0, 120)}`, ms };
      } catch (e) {
        return { ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 };
      }
    },
  },
  {
    provider: "openrouter",
    label: "OpenRouter",
    ping: async (key) => {
      const t0 = Date.now();
      try {
        const res = await fetch("https://openrouter.ai/api/v1/models?supported_parameters=tools", {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(8000),
        });
        const ms = Date.now() - t0;
        if (res.ok) return { ok: true, detail: `${res.status} OK`, ms };
        const body = await res.text().catch(() => "");
        return { ok: false, detail: `HTTP ${res.status} — ${body.slice(0, 120)}`, ms };
      } catch (e) {
        return { ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 };
      }
    },
  },
  {
    provider: "canlii",
    label: "CanLII (data source)",
    // CanLII API has no CORS headers, so we proxy via a server route.
    ping: async (key) => {
      const t0 = Date.now();
      try {
        const res = await fetch("/api/canlii/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: key }),
          signal: AbortSignal.timeout(10_000),
        });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean; detail?: string; ms?: number;
        };
        const ms = json.ms ?? Date.now() - t0;
        return {
          ok: Boolean(json.ok),
          detail: json.detail ?? `HTTP ${res.status}`,
          ms,
        };
      } catch (e) {
        return { ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 };
      }
    },
  },
];

export function ProviderPings() {
  const [results, setResults] = useState<ProviderResult[]>([]);
  const [running, setRunning] = useState(false);

  function buildInitialResults(keys: Record<string, string>): ProviderResult[] {
    return PROVIDERS.map((p) => ({
      provider: p.provider,
      label: p.label,
      status: keys[p.provider]?.trim() ? ("idle" as PingStatus) : ("no-key" as PingStatus),
    }));
  }

  async function runPings() {
    const keys = loadApiKeys();
    const initial = buildInitialResults(keys);
    setResults(initial);
    setRunning(true);

    await Promise.all(
      PROVIDERS.map(async (p) => {
        const key = keys[p.provider]?.trim();
        if (!key) return;

        setResults((prev) =>
          prev.map((r) => (r.provider === p.provider ? { ...r, status: "pinging" } : r))
        );

        const { ok, detail, ms } = await p.ping(key);

        setResults((prev) =>
          prev.map((r) =>
            r.provider === p.provider
              ? { ...r, status: ok ? "ok" : "error", detail, ms }
              : r
          )
        );
      })
    );

    setRunning(false);
  }

  useEffect(() => {
    runPings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const configuredCount = results.filter((r) => r.status !== "no-key").length;
  const okCount = results.filter((r) => r.status === "ok").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Provider connectivity
          </h2>
          {configuredCount === 0 && (
            <p className="mt-0.5 text-xs text-slate-400">
              No API keys configured — go to Settings to add them.
            </p>
          )}
        </div>
        <button
          onClick={runPings}
          disabled={running}
          className="shrink-0 rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {running ? "Pinging…" : "Ping all"}
        </button>
      </div>

      {configuredCount > 0 && !running && results.every((r) => r.status !== "pinging") && (
        <div
          className={`mb-3 rounded border px-3 py-2 text-sm ${
            errorCount > 0
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              : "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
          }`}
        >
          <strong>{okCount}</strong> / {configuredCount} configured providers reachable
          {errorCount > 0 && <> — {errorCount} failed</>}
        </div>
      )}

      <ul className="space-y-2">
        {results.map((r) => (
          <li key={r.provider} className="flex flex-col gap-0.5 rounded-md border border-slate-100 px-3 py-2 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <StatusBadge status={r.status} />
              <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                {r.label}
              </span>
              {r.ms !== undefined && (
                <span className="shrink-0 text-xs text-slate-400">{r.ms}ms</span>
              )}
            </div>
            {r.detail && r.status !== "ok" && (
              <p className="pl-1 text-xs text-slate-500 dark:text-slate-400 break-words">
                {r.detail}
              </p>
            )}
            {r.status === "no-key" && (
              <p className="pl-1 text-xs text-slate-400">
                No API key — add one in{" "}
                <a href="/settings" className="underline hover:text-slate-700 dark:hover:text-slate-200">
                  Settings
                </a>
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusBadge({ status }: { status: PingStatus }) {
  const map: Record<PingStatus, { label: string; cls: string }> = {
    idle:    { label: "—",       cls: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
    pinging: { label: "PING",   cls: "animate-pulse bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
    ok:      { label: "OK",     cls: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" },
    error:   { label: "ERROR",  cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
    "no-key":{ label: "NO KEY", cls: "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}
