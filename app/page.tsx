"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BUILTIN_PRESETS, type ModelPreset } from "@/lib/presets";
import {
  loadApiKeys,
  loadCustomModels,
  loadSelectedModels,
  saveSelectedModels,
} from "@/lib/storage";
import { buildVerificationPrompt } from "@/lib/prompts";

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
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, ResultState>>({});

  useEffect(() => {
    const custom = loadCustomModels();
    setAllModels([...BUILTIN_PRESETS, ...custom]);
    setApiKeys(loadApiKeys());
    setSelected(loadSelectedModels());
  }, []);

  useEffect(() => {
    saveSelectedModels(selected);
  }, [selected]);

  const groupedModels = useMemo(() => {
    const groups: Record<string, ModelPreset[]> = {};
    for (const m of allModels) {
      const key = m.kind === "deep-link" ? "Manual paste (no API)" : m.provider;
      groups[key] = groups[key] ?? [];
      groups[key].push(m);
    }
    return groups;
  }, [allModels]);

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

    const prompt = buildVerificationPrompt({
      claudeAnswer,
      documentText,
      userQuestion,
    });

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
          <Link href="/settings" className="text-xs text-blue-600 hover:underline">
            Manage keys & custom models →
          </Link>
        </div>
        <div className="space-y-3">
          {Object.entries(groupedModels).map(([group, items]) => (
            <div key={group}>
              <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">{group}</h3>
              <div className="grid gap-1 sm:grid-cols-2">
                {items.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-start gap-2 rounded border p-2 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(m.id)}
                      onChange={() => toggleModel(m.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block">{m.label}</span>
                      {m.note && <span className="block text-xs text-slate-500">{m.note}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
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

      {Object.keys(results).length > 0 && (
        <section className="grid gap-4 lg:grid-cols-2">
          {selected.map((id) => {
            const model = allModels.find((m) => m.id === id);
            const r = results[id];
            if (!model || !r) return null;
            return (
              <div key={id} className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold">{model.label}</h3>
                  {r.status === "ok" && (
                    <button
                      onClick={() => navigator.clipboard.writeText(r.text)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Copy
                    </button>
                  )}
                </div>
                {r.status === "loading" && (
                  <p className="text-sm text-slate-500">Working…</p>
                )}
                {r.status === "error" && (
                  <p className="text-sm text-red-600">{r.error}</p>
                )}
                {r.status === "ok" && (
                  <pre className="whitespace-pre-wrap text-sm">{r.text}</pre>
                )}
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
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
