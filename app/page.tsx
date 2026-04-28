"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BUILTIN_PRESETS, type ModelPreset } from "@/lib/presets";
import {
  clearDraft,
  loadApiKeys,
  loadCustomModels,
  loadDraft,
  loadGroupState,
  loadModelRoles,
  loadPromptOverrides,
  loadSelectedModels,
  saveDraft,
  saveGroupState,
  saveModelRoles,
  saveSelectedModels,
  type GroupState,
  type RoleMap,
} from "@/lib/storage";
import {
  buildPromptForRole,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type PromptOverrides,
  type VerificationRole,
} from "@/lib/prompts";
import { humanizeError } from "@/lib/errors";
import { pullFromServer, pushSnapshot, writeLocalSnapshot } from "@/lib/sync";
import { useToast } from "@/components/Toast";

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

type Verdict = "green" | "yellow" | "red" | "none";

function parseVerdict(text: string): { verdict: Verdict; body: string } {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i].trim().toUpperCase();
    if (line === "[GREEN]" || line.startsWith("[GREEN]")) {
      return { verdict: "green", body: lines.slice(i + 1).join("\n").trimStart() };
    }
    if (line === "[YELLOW]" || line.startsWith("[YELLOW]")) {
      return { verdict: "yellow", body: lines.slice(i + 1).join("\n").trimStart() };
    }
    if (line === "[RED]" || line.startsWith("[RED]")) {
      return { verdict: "red", body: lines.slice(i + 1).join("\n").trimStart() };
    }
  }
  return { verdict: "none", body: text };
}

const VERDICT_STYLES: Record<Verdict, { card: string; chip: string; chipText: string; emoji: string }> = {
  green: {
    card: "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30",
    chip: "bg-emerald-200 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200",
    chipText: "Looks correct",
    emoji: "✓",
  },
  yellow: {
    card: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
    chip: "bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200",
    chipText: "Some concerns",
    emoji: "!",
  },
  red: {
    card: "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30",
    chip: "bg-rose-200 text-rose-900 dark:bg-rose-900/60 dark:text-rose-200",
    chipText: "Major issues",
    emoji: "✗",
  },
  none: {
    card: "bg-white dark:bg-slate-900",
    chip: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    chipText: "No verdict tag",
    emoji: "?",
  },
};

export default function HomePage() {
  const toast = useToast();
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
  const [groupOpen, setGroupOpen] = useState<GroupState>({});
  const [modelFilter, setModelFilter] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [promptOverrides, setPromptOverrides] = useState<PromptOverrides>({});
  const [signedIn, setSignedIn] = useState<boolean>(false);

  useEffect(() => {
    const custom = loadCustomModels();
    setAllModels([...BUILTIN_PRESETS, ...custom]);
    setApiKeys(loadApiKeys());
    setSelected(loadSelectedModels());
    setRoles(loadModelRoles());
    setGroupOpen(loadGroupState());
    setPromptOverrides(loadPromptOverrides());
    const draft = loadDraft();
    if (draft) {
      setUserQuestion(draft.userQuestion);
      setClaudeAnswer(draft.claudeAnswer);
      setDocumentText(draft.documentText);
      setDocFileName(draft.docFileName);
    }
    setHydrated(true);
    fetchOpenRouterModels();

    // Pull server snapshot in the background; if signed in, sync local state
    void (async () => {
      const res = await pullFromServer();
      if (!res.ok) {
        if (res.reason !== "not-signed-in") {
          // server might be down or misconfigured; silent — local works
        }
        return;
      }
      setSignedIn(true);
      if (res.data && Object.keys(res.data).length > 0) {
        writeLocalSnapshot(res.data);
        if (res.data.apiKeys) setApiKeys(res.data.apiKeys);
        if (res.data.customModels) {
          setAllModels([...BUILTIN_PRESETS, ...res.data.customModels]);
        }
        if (res.data.modelRoles) setRoles(res.data.modelRoles as RoleMap);
        if (res.data.promptOverrides) setPromptOverrides(res.data.promptOverrides);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pushIfSignedIn() {
    if (!signedIn) return;
    await pushSnapshot();
  }

  useEffect(() => {
    if (!hydrated) return;
    saveDraft({ userQuestion, claudeAnswer, documentText, docFileName });
  }, [hydrated, userQuestion, claudeAnswer, documentText, docFileName]);

  useEffect(() => {
    if (!hydrated) return;
    saveGroupState(groupOpen);
  }, [hydrated, groupOpen]);

  function toggleGroupOpen(group: string) {
    setGroupOpen((prev) => ({ ...prev, [group]: !prev[group] }));
  }

  function isGroupOpen(group: string): boolean {
    return groupOpen[group] ?? group === "groq";
  }

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
    if (hydrated) void pushIfSignedIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles]);

  function setRoleFor(id: string, role: VerificationRole) {
    setRoles((prev) => ({ ...prev, [id]: role }));
  }

  function getRole(id: string): VerificationRole {
    return roles[id] ?? "comprehensive";
  }

  const MANUAL_GROUP = "Manual paste (no API)";

  const groupedModels = useMemo<[string, ModelPreset[]][]>(() => {
    const filter = modelFilter.trim().toLowerCase();
    const groups: Record<string, ModelPreset[]> = {};
    for (const m of allModels) {
      if (filter && !m.label.toLowerCase().includes(filter) && !(m.modelId ?? "").toLowerCase().includes(filter)) {
        continue;
      }
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
  }, [allModels, modelFilter]);

  const totalSelected = selected.length;
  const totalModels = allModels.length;

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
      toast.show("warn", "Paste Claude's answer first.");
      return;
    }
    if (selected.length === 0) {
      toast.show("warn", "Select at least one model.");
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

        const prompt = buildPromptForRole(
          getRole(id),
          { claudeAnswer, documentText, userQuestion },
          promptOverrides
        );

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

  const totalToRun = selected.length;
  const totalDone = Object.values(results).filter(
    (r) => r.status === "ok" || r.status === "error" || r.status === "deeplink"
  ).length;
  const isRunning = totalToRun > 0 && totalDone < totalToRun &&
    Object.values(results).some((r) => r.status === "loading");

  function sectionHeader(num: number, title: string, hint?: string) {
    return (
      <div className="mb-3 flex items-baseline gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
          {num}
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          {hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
        {sectionHeader(1, "Your question", "Optional — gives the AI context for what was asked.")}
        <textarea
          className="w-full resize-y rounded border border-slate-300 bg-white p-2 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-900/40"
          rows={2}
          placeholder="What was the original legal question you asked Claude?"
          value={userQuestion}
          onChange={(e) => setUserQuestion(e.target.value)}
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
        {sectionHeader(2, "Paste Claude's answer", "The text you want other models to check.")}
        <textarea
          className="w-full resize-y rounded border border-slate-300 bg-white p-2 font-mono text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-900/40"
          rows={8}
          placeholder="Paste the answer you want verified..."
          value={claudeAnswer}
          onChange={(e) => setClaudeAnswer(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {claudeAnswer.length.toLocaleString()} chars · auto-saved in this browser
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
        {sectionHeader(3, "Reference document", "Upload a .docx or .txt — its text is sent along with the answer.")}
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 hover:border-blue-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:border-blue-700 dark:hover:bg-slate-800/50">
          <span className="text-base">📄</span>
          <span>
            <span className="font-medium text-slate-700 dark:text-slate-200">Click to upload</span> a .docx or .txt file
          </span>
          <input
            type="file"
            accept=".docx,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
        {parsing && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Parsing…</p>}
        {docError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{docError}</p>}
        {docFileName && !parsing && !docError && (
          <div className="mt-2 flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800/40">
            <span>
              <span className="font-medium">{docFileName}</span>
              <span className="ml-2 text-slate-500 dark:text-slate-400">
                {documentText.length.toLocaleString()} chars
              </span>
            </span>
            <button
              onClick={() => {
                setDocFileName("");
                setDocumentText("");
                setDocError("");
              }}
              className="text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
            >
              Remove
            </button>
          </div>
        )}
        {documentText && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-slate-600 dark:text-slate-400">Preview extracted text</summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded bg-slate-50 p-2 text-xs whitespace-pre-wrap dark:bg-slate-800/40">
              {documentText.slice(0, 4000)}
              {documentText.length > 4000 ? "\n… (truncated in preview)" : ""}
            </pre>
          </details>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
              4
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Pick AI models</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {totalSelected} of {totalModels} selected
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={fetchOpenRouterModels}
              disabled={orStatus === "loading"}
              className="text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
              title="Re-fetch the current list of free OpenRouter models"
            >
              {orStatus === "loading" ? "Refreshing…" : "Refresh OpenRouter"}
            </button>
            <Link href="/settings" className="text-blue-600 hover:underline dark:text-blue-400">
              Settings →
            </Link>
          </div>
        </div>

        <div className="mb-3 flex gap-2">
          <input
            type="search"
            placeholder="Search models (name or ID)…"
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-900/40"
          />
          {modelFilter && (
            <button
              onClick={() => setModelFilter("")}
              className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Clear
            </button>
          )}
        </div>

        {orStatus === "error" && (
          <p className="mb-2 rounded bg-yellow-50 p-2 text-xs text-yellow-800">
            Couldn&apos;t load live OpenRouter models: {orError}. Built-in models still work.
          </p>
        )}

        <div className="space-y-2">
          {groupedModels.length === 0 && (
            <p className="rounded border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No models match &ldquo;{modelFilter}&rdquo;.
            </p>
          )}
          {groupedModels.map(([group, items]) => {
            const groupSelected = items.filter((m) => selected.includes(m.id)).length;
            const allOn = items.length > 0 && groupSelected === items.length;
            const someOn = groupSelected > 0;
            const open = isGroupOpen(group) || modelFilter.length > 0;
            return (
              <div key={group} className="rounded-md border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/50">
                  <label className="flex flex-1 cursor-pointer items-center gap-2 text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={allOn}
                      ref={(el) => {
                        if (el) el.indeterminate = someOn && !allOn;
                      }}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleGroup(items);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4"
                    />
                    <span onClick={() => toggleGroupOpen(group)} className="flex-1 py-1">
                      {group}{" "}
                      <span className="font-normal normal-case text-slate-500 dark:text-slate-400">
                        ({groupSelected > 0 ? `${groupSelected}/` : ""}
                        {items.length})
                      </span>
                    </span>
                  </label>
                  <button
                    onClick={() => toggleGroupOpen(group)}
                    className="ml-2 flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                    aria-label={open ? "Collapse" : "Expand"}
                  >
                    {open ? "▾" : "▸"}
                  </button>
                </div>
                {open && (
                  <div className="space-y-1 p-2">
                    {items.map((m) => {
                      const isSelected = selected.includes(m.id);
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col gap-2 rounded border p-2 text-sm sm:flex-row sm:items-start ${
                            isSelected
                              ? "border-blue-300 bg-blue-50/40 dark:border-blue-800 dark:bg-blue-950/30"
                              : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <label className="flex flex-1 items-start gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleModel(m.id)}
                              className="mt-1"
                            />
                            <span className="min-w-0">
                              <span className="block">{m.label}</span>
                              {m.note && (
                                <span className="block text-xs text-slate-500 dark:text-slate-400">{m.note}</span>
                              )}
                            </span>
                          </label>
                          {isSelected && (
                            <div className="flex shrink-0 items-center gap-1 sm:ml-2">
                              <label className="text-xs text-slate-500 dark:text-slate-400">Role:</label>
                              <select
                                value={getRole(m.id)}
                                onChange={(e) =>
                                  setRoleFor(m.id, e.target.value as VerificationRole)
                                }
                                className="rounded border border-slate-300 bg-white px-1 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* sticky action bar — fixed at the bottom of the viewport */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3">
          <div className="text-xs sm:text-sm">
            {isRunning ? (
              <span className="text-slate-700 dark:text-slate-200">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-600 align-middle dark:bg-blue-400"></span>{" "}
                Verifying… {totalDone}/{totalToRun} models replied
              </span>
            ) : selected.length === 0 ? (
              <span className="text-slate-500 dark:text-slate-400">Pick at least one model below.</span>
            ) : (
              <span className="text-slate-700 dark:text-slate-200">
                Ready to verify with{" "}
                <span className="font-semibold">{selected.length}</span>{" "}
                model{selected.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const ok = await toast.confirm("Clear all inputs and results?");
                if (!ok) return;
                setClaudeAnswer("");
                setUserQuestion("");
                setDocumentText("");
                setDocFileName("");
                setResults({});
                clearDraft();
                toast.show("success", "Cleared");
              }}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:flex-none"
            >
              Reset
            </button>
            <button
              onClick={runVerify}
              disabled={isRunning || !claudeAnswer.trim() || selected.length === 0}
              className="flex-[2] rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-blue-500 dark:hover:bg-blue-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-500 sm:flex-none"
            >
              {isRunning
                ? "Working…"
                : `Verify${selected.length ? ` with ${selected.length}` : ""}`}
            </button>
          </div>
        </div>
      </div>

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
          const parsed = r.status === "ok" ? parseVerdict(r.text) : null;
          const style = parsed ? VERDICT_STYLES[parsed.verdict] : VERDICT_STYLES.none;
          return (
            <div
              key={id}
              className={`rounded-lg border border-slate-200 p-3 shadow-sm dark:border-slate-800 sm:p-4 ${
                r.status === "ok" ? style.card : "bg-white dark:bg-slate-900"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">{model.label}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Role: {ROLE_LABELS[getRole(id)]}</p>
                </div>
                <div className="flex items-center gap-2">
                  {parsed && parsed.verdict !== "none" && (
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${style.chip}`}
                    >
                      {style.emoji} {style.chipText}
                    </span>
                  )}
                  {r.status === "ok" && (
                    <button
                      onClick={() => navigator.clipboard.writeText(r.text)}
                      className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Copy
                    </button>
                  )}
                </div>
              </div>
              {r.status === "loading" && (
                <div className="space-y-2">
                  <div className="h-3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                </div>
              )}
              {r.status === "ok" && parsed && (
                <div className="prose prose-sm max-w-none overflow-x-auto break-words dark:prose-invert prose-headings:mt-3 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-pre:overflow-x-auto prose-table:block prose-table:overflow-x-auto">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsed.body}</ReactMarkdown>
                </div>
              )}
              {r.status === "deeplink" && (
                <div className="text-sm">
                  <p className="mb-2 text-slate-700 dark:text-slate-300">
                    Prompt copied to clipboard. Open the site and paste:
                  </p>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
                  >
                    Open {model.label}
                  </a>
                </div>
              )}
              {r.status === "error" && (() => {
                const e = humanizeError(r.error, model.label);
                return (
                  <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm dark:border-rose-900/50 dark:bg-rose-950/30">
                    <p className="font-medium text-rose-800 dark:text-rose-300">{e.title}</p>
                    <p className="mt-1 whitespace-pre-line text-rose-700 dark:text-rose-300/90">{e.hint}</p>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-rose-600 dark:text-rose-400">
                        Technical details
                      </summary>
                      <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-rose-900 dark:text-rose-200/90">
                        {e.raw}
                      </pre>
                    </details>
                  </div>
                );
              })()}
            </div>
          );
        };

        const okCount = orderedIds.filter((id) => results[id]?.status === "ok").length;

        return (
          <section className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
              <div className="flex items-baseline gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                  5
                </span>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Results</h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {okCount} success · {errorIds.length} failed · {orderedIds.length} total
              </p>
            </div>
            {successIds.map(renderCard)}
            {errorIds.length > 0 && (
              <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">
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
