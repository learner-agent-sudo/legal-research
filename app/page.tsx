"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BUILTIN_PRESETS, type ModelPreset } from "@/lib/presets";
import {
  loadApiKeys,
  loadCustomModels,
  loadModelRoles,
  loadSelectedModels,
  saveModelRoles,
  saveSelectedModels,
  type RoleMap,
} from "@/lib/storage";
import {
  buildPromptForRole,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type VerificationRole,
} from "@/lib/prompts";
import { humanizeError } from "@/lib/errors";

const ROLE_OPTIONS: VerificationRole[] = [
  "comprehensive",
  "statute",
  "case-law",
  "logic",
  "counter",
];

type ResultState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; text: string }
  | { status: "error"; error: string }
  | { status: "deeplink"; url: string };

export default function HomePage() {
  const [userQuestion, setUserQuestion] = useState("");
  const [claudeAnswer, setClaudeAnswer] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [docFileName, setDocFileName] = useState<string>("");
  const [docError, setDocError] = useState<string>("");
  const [parsing, setParsing] = useState(false);

  const [allModels, setAllModels] = useState<ModelPreset[]>(BUILTIN_PRESETS);
  const [selected, setSelected] = useState<string[]>([]);
  const [roles, setRoles] = useState<RoleMap>({});
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, ResultState>>({});
  const [orStatus, setOrStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [orError, setOrError] = useState<string>("");

  useEffect(() => {
    const custom = loadCustomModels();
    setAllModels([...BUILTIN_PRESETS, ...custom]);
    setApiKeys(loadApiKeys());
    setSelected(loadSelectedModels());
    setRoles(loadModelRoles());
    fetchOpenRouterModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchOpenRouterModels() {
    setOrStatus("loading");
    setOrError("");
    try {
      const res = await fetch("/api/openrouter-models");
      const json = (await res.json()) as {
        models?: { id: string; name: string; contextLength: number }[];
        error?: string;
      };
      if (!res.ok || !json.models) throw new Error(json.error ?? `HTTP ${res.status}`);

      const dynamic: ModelPreset[] = json.models.map((m) => ({
        id: `openrouter-live-${m.id}`,
        label: `${m.name} (OpenRouter, free)`,
        provider: "openrouter",
        kind: "openai-compat",
        baseUrl: "https://openrouter.ai/api/v1",
        modelId: m.id,
        contextLength: m.contextLength > 0 ? m.contextLength : undefined,
        note:
          m.contextLength > 0
            ? `Context: ${m.contextLength.toLocaleString()} tokens`
            : undefined,
      }));

      setAllModels((prev) => {
        // remove any prior live OpenRouter entries, then add the fresh batch
        const withoutLive = prev.filter((p) => !p.id.startsWith("openrouter-live-"));
        return [...withoutLive, ...dynamic];
      });
      setOrStatus("ok");
    } catch (err) {
      setOrError(err instanceof Error ? err.message : "Failed");
      setOrStatus("error");
    }
  }

  useEffect(() => {
    saveSelectedModels(selected);
  }, [selected]);

  useEffect(() => {
    saveModelRoles(roles);
  }, [roles]);

  function setRoleFor(id: string, role: VerificationRole) {
    setRoles((prev) => ({ ...prev, [id]: role }));
  }

  function getRole(id: string): VerificationRole {
    return roles[id] ?? "comprehensive";
  }

  const MANUAL_GROUP = "Manual paste (no API)";

  const groupedModels = useMemo<[string, ModelPreset[]][]>(() => {
    const groups: Record<string, ModelPreset[]> = {};
    for (const m of allModels) {
      const key = m.kind === "deep-link" ? MANUAL_GROUP : m.provider;
      groups[key] = groups[key] ?? [];
      groups[key].push(m);
    }
    if (groups.openrouter) {
      groups.openrouter.sort(
        (a, b) => (b.contextLength ?? 0) - (a.contextLength ?? 0)
      );
    }
    const entries = Object.entries(groups);
    const manual = entries.filter(([k]) => k === MANUAL_GROUP);
    const others = entries.filter(([k]) => k !== MANUAL_GROUP);
    return [...others, ...manual];
  }, [allModels]);

  function toggleGroup(items: ModelPreset[]) {
    const ids = items.map((m) => m.id);
    const allOn = ids.every((id) => selected.includes(id));
    setSelected((prev) => {
      if (allOn) return prev.filter((id) => !ids.includes(id));
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return Array.from(next);
    });
  }

  function toggleModel(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocError("");
    setDocFileName(file.name);

    if (file.name.toLowerCase().endsWith(".txt")) {
      setParsing(true);
      try {
        const text = await file.text();
        setDocumentText(text);
      } finally {
        setParsing(false);
      }
      return;
    }

    if (!file.name.toLowerCase().endsWith(".docx")) {
      setDocError("Only .docx and .txt files are supported.");
      return;
    }

    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-docx", { method: "POST", body: fd });
      const json = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Parse failed");
      setDocumentText(json.text ?? "");
    } catch (err) {
      setDocError(err instanceof Error ? err.message : "Parse failed");
      setDocumentText("");
    } finally {
      setParsing(false);
    }
  }

  async function runVerify() {
    if (!claudeAnswer.trim()) {
      alert("Paste Claude's answer first.");
      return;
    }
    if (selected.length === 0) {
      alert("Select at least one model.");
      return;
    }

    const initial: Record<string, ResultState> = {};
    selected.forEach((id) => (initial[id] = { status: "loading" }));
    setResults(initial);

    await Promise.all(
      selected.map(async (id) => {
        const model = allModels.find((m) => m.id === id);
        if (!model) {
          setResults((r) => ({ ...r, [id]: { status: "error", error: "Model not found" } }));
          return;
        }

        const prompt = buildPromptForRole(getRole(id), {
          claudeAnswer,
          documentText,
          userQuestion,
        });

        if (model.kind === "deep-link") {
          try {
            await navigator.clipboard.writeText(prompt);
          } catch {
            // clipboard may fail in some browsers; user can still open the link
          }
          setResults((r) => ({
            ...r,
            [id]: { status: "deeplink", url: model.deepLinkUrl ?? "https://example.com" },
          }));
          return;
        }

        const apiKey = apiKeys[model.provider];
        if (!apiKey) {
          setResults((r) => ({
            ...r,
            [id]: {
              status: "error",
              error: `No API key for ${model.provider}. Add it in Settings.`,
            },
          }));
          return;
        }

        try {
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
          setResults((r) => ({ ...r, [id]: { status: "ok", text: json.text ?? "" } }));
        } catch (err) {
          setResults((r) => ({
            ...r,
            [id]: { status: "error", error: err instanceof Error ? err.message : "Failed" },
          }));
        }
      })
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold">1. Your question (optional)</h2>
        <textarea
          className="w-full resize-y rounded border p-2 text-sm"
          rows={2}
          placeholder="What was the original legal question you asked Claude?"
          value={userQuestion}
          onChange={(e) => setUserQuestion(e.target.value)}
        />
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold">2. Paste Claude&apos;s answer</h2>
        <textarea
          className="w-full resize-y rounded border p-2 font-mono text-sm"
          rows={8}
          placeholder="Paste the answer you want verified..."
          value={claudeAnswer}
          onChange={(e) => setClaudeAnswer(e.target.value)}
        />
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold">3. Reference document (.docx or .txt)</h2>
        <input
          type="file"
          accept=".docx,.txt"
          onChange={handleFileUpload}
          className="text-sm"
        />
        {parsing && <p className="mt-2 text-xs text-slate-500">Parsing…</p>}
        {docError && <p className="mt-2 text-xs text-red-600">{docError}</p>}
        {docFileName && !parsing && !docError && (
          <p className="mt-2 text-xs text-slate-600">
            Loaded <span className="font-mono">{docFileName}</span> — {documentText.length.toLocaleString()} chars
          </p>
        )}
        {documentText && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-slate-600">Preview extracted text</summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded bg-slate-50 p-2 text-xs whitespace-pre-wrap">
              {documentText.slice(0, 4000)}
              {documentText.length > 4000 ? "\n… (truncated in preview)" : ""}
            </pre>
          </details>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">4. Pick AI models to verify with</h2>
          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={fetchOpenRouterModels}
              disabled={orStatus === "loading"}
              className="text-blue-600 hover:underline disabled:opacity-50"
              title="Re-fetch the current list of free OpenRouter models"
            >
              {orStatus === "loading" ? "Refreshing OpenRouter…" : "Refresh OpenRouter list"}
            </button>
            <Link href="/settings" className="text-blue-600 hover:underline">
              Settings →
            </Link>
          </div>
        </div>
        {orStatus === "error" && (
          <p className="mb-2 rounded bg-yellow-50 p-2 text-xs text-yellow-800">
            Couldn&apos;t load live OpenRouter models: {orError}. Built-in models still work.
          </p>
        )}
        {orStatus === "ok" && (
          <p className="mb-2 text-xs text-slate-500">
            OpenRouter free models loaded live. List refreshes every 5 minutes.
          </p>
        )}
        <div className="space-y-3">
          {groupedModels.map(([group, items]) => {
            const allOn = items.every((m) => selected.includes(m.id));
            const someOn = items.some((m) => selected.includes(m.id));
            return (
            <div key={group}>
              <label className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                <input
                  type="checkbox"
                  checked={allOn}
                  ref={(el) => {
                    if (el) el.indeterminate = someOn && !allOn;
                  }}
                  onChange={() => toggleGroup(items)}
                />
                {group} ({items.length})
              </label>
              <div className="space-y-1">
                {items.map((m) => {
                  const isSelected = selected.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      className="flex flex-col gap-2 rounded border p-2 text-sm hover:bg-slate-50 sm:flex-row sm:items-start"
                    >
                      <label className="flex flex-1 items-start gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleModel(m.id)}
                          className="mt-1"
                        />
                        <span>
                          <span className="block">{m.label}</span>
                          {m.note && (
                            <span className="block text-xs text-slate-500">{m.note}</span>
                          )}
                        </span>
                      </label>
                      {isSelected && (
                        <div className="flex shrink-0 items-center gap-1 sm:ml-2">
                          <label className="text-xs text-slate-500">Role:</label>
                          <select
                            value={getRole(m.id)}
                            onChange={(e) =>
                              setRoleFor(m.id, e.target.value as VerificationRole)
                            }
                            className="rounded border bg-white px-1 py-0.5 text-xs"
                            title={ROLE_DESCRIPTIONS[getRole(m.id)]}
                          >
                            {ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      </section>

      <section className="flex gap-2">
        <button
          onClick={runVerify}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Verify with {selected.length || 0} model{selected.length === 1 ? "" : "s"}
        </button>
        <button
          onClick={() => {
            setClaudeAnswer("");
            setUserQuestion("");
            setDocumentText("");
            setDocFileName("");
            setResults({});
          }}
          className="rounded-md border px-4 py-2 text-sm"
        >
          Reset
        </button>
      </section>

      {Object.keys(results).length > 0 && (() => {
        const orderedIds = selected.filter((id) => results[id]);
        const successIds = orderedIds.filter((id) => {
          const s = results[id]?.status;
          return s === "ok" || s === "deeplink" || s === "loading";
        });
        const errorIds = orderedIds.filter((id) => results[id]?.status === "error");

        const renderCard = (id: string) => {
          const model = allModels.find((m) => m.id === id);
          const r = results[id];
          if (!model || !r) return null;
          return (
            <div key={id} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{model.label}</h3>
                  <p className="text-xs text-slate-500">Role: {ROLE_LABELS[getRole(id)]}</p>
                </div>
                {r.status === "ok" && (
                  <button
                    onClick={() => navigator.clipboard.writeText(r.text)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Copy
                  </button>
                )}
              </div>
              {r.status === "loading" && <p className="text-sm text-slate-500">Working…</p>}
              {r.status === "ok" && <pre className="whitespace-pre-wrap text-sm">{r.text}</pre>}
              {r.status === "deeplink" && (
                <div className="text-sm">
                  <p className="mb-2 text-slate-700">
                    Prompt copied to clipboard. Open the site and paste:
                  </p>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700"
                  >
                    Open {model.label}
                  </a>
                </div>
              )}
              {r.status === "error" && (() => {
                const e = humanizeError(r.error, model.label);
                return (
                  <div className="rounded border border-red-200 bg-red-50 p-3 text-sm">
                    <p className="font-medium text-red-800">{e.title}</p>
                    <p className="mt-1 whitespace-pre-line text-red-700">{e.hint}</p>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-red-600">
                        Technical details
                      </summary>
                      <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-red-900">
                        {e.raw}
                      </pre>
                    </details>
                  </div>
                );
              })()}
            </div>
          );
        };

        return (
          <section className="space-y-4">
            {successIds.map(renderCard)}
            {errorIds.length > 0 && (
              <details className="rounded-lg border bg-slate-50 p-3 text-sm">
                <summary className="cursor-pointer font-medium text-slate-700">
                  {errorIds.length} model{errorIds.length === 1 ? "" : "s"} failed (click to expand)
                </summary>
                <div className="mt-3 space-y-3">{errorIds.map(renderCard)}</div>
              </details>
            )}
          </section>
        );
      })()}
    </div>
  );
}
