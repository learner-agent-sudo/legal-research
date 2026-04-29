"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PROVIDER_KEY_NAMES,
  PROVIDER_SIGNUP_URLS,
  type ModelPreset,
} from "@/lib/presets";
import {
  exportConfig,
  importConfig,
  loadApiKeys,
  loadCustomModels,
  saveApiKeys,
  saveCustomModels,
  type ImportSummary,
} from "@/lib/storage";
import {
  pullFromServer,
  pushSnapshot,
  smartSync,
  writeLocalSnapshot,
} from "@/lib/sync";
import { clearHistory, listSessions } from "@/lib/history";
import { useToast } from "@/components/Toast";

const KNOWN_PROVIDERS = ["groq", "openrouter", "gemini", "mistral"];

type SyncState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "signed-in"; lastSyncedAt?: string }
  | { status: "signed-out" }
  | { status: "error"; message: string };

export default function SettingsPage() {
  const toast = useToast();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<ModelPreset[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const [ioMessage, setIoMessage] = useState<string>("");
  const [ioError, setIoError] = useState<string>("");
  const [sync, setSync] = useState<SyncState>({ status: "idle" });
  const [syncFlash, setSyncFlash] = useState<string>("");
  const [historyCount, setHistoryCount] = useState<number | null>(null);

  // form state for adding a custom model
  const [form, setForm] = useState({
    label: "",
    provider: "",
    baseUrl: "",
    modelId: "",
    apiKey: "",
  });

  useEffect(() => {
    setKeys(loadApiKeys());
    setCustom(loadCustomModels());
    void initialSync();
    void listSessions().then((r) => { if (r.ok) setHistoryCount(r.sessions.length); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initialSync() {
    setSync({ status: "checking" });
    const res = await smartSync();
    if (!res.ok) {
      if (res.reason === "not-signed-in") {
        setSync({ status: "signed-out" });
      } else if (res.reason === "not-configured") {
        setSync({ status: "error", message: "Server sync isn't configured on this deployment." });
      } else {
        setSync({ status: "error", message: res.message ?? "Sync error" });
      }
      return;
    }
    // Refresh in-page state from whatever localStorage now holds
    setKeys(loadApiKeys());
    setCustom(loadCustomModels());
    setSync({ status: "signed-in", lastSyncedAt: res.data?.updatedAt });
    if (res.action === "migrated") {
      setSyncFlash("Uploaded your existing local keys to your account");
      setTimeout(() => setSyncFlash(""), 3000);
    } else if (res.action === "pulled") {
      setSyncFlash("Pulled your saved settings from your account");
      setTimeout(() => setSyncFlash(""), 3000);
    }
  }

  async function pushIfSignedIn() {
    if (sync.status !== "signed-in") return;
    const res = await pushSnapshot();
    if (res.ok) {
      setSync({ status: "signed-in", lastSyncedAt: new Date().toISOString() });
      setSyncFlash("Synced to your account");
      setTimeout(() => setSyncFlash(""), 1500);
    } else if (res.reason === "not-signed-in") {
      setSync({ status: "signed-out" });
    } else {
      setSync({ status: "error", message: res.message ?? "Sync error" });
    }
  }

  function handleSaveKeys() {
    saveApiKeys(keys);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
    void pushIfSignedIn();
  }

  function handleAddCustom() {
    if (!form.label || !form.baseUrl || !form.modelId || !form.provider) {
      toast.show("warn", "Label, provider, base URL, and model ID are required.");
      return;
    }
    const id = `custom-${form.provider}-${form.modelId}-${Date.now()}`;
    const next: ModelPreset = {
      id,
      label: form.label,
      provider: form.provider,
      kind: "openai-compat",
      baseUrl: form.baseUrl,
      modelId: form.modelId,
    };
    const updatedCustom = [...custom, next];
    setCustom(updatedCustom);
    saveCustomModels(updatedCustom);
    if (form.apiKey) {
      const updatedKeys = { ...keys, [form.provider]: form.apiKey };
      setKeys(updatedKeys);
      saveApiKeys(updatedKeys);
    }
    setForm({ label: "", provider: "", baseUrl: "", modelId: "", apiKey: "" });
    void pushIfSignedIn();
  }

  function handleRemoveCustom(id: string) {
    const next = custom.filter((m) => m.id !== id);
    setCustom(next);
    saveCustomModels(next);
    void pushIfSignedIn();
  }

  function handleExport() {
    const cfg = exportConfig();
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `legal-research-config-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setIoMessage("Saved a JSON file. Treat it like a password file — the keys are unencrypted.");
    setIoError("");
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIoMessage("");
    setIoError("");
    try {
      const text = await file.text();
      const json: unknown = JSON.parse(text);
      const summary: ImportSummary = importConfig(json);
      setKeys(loadApiKeys());
      setCustom(loadCustomModels());
      setIoMessage(
        `Imported: ${summary.apiKeys} keys · ${summary.customModels} custom models · ` +
          `${summary.selectedModels} selections · ${summary.modelRoles} role assignments. ` +
          "Refresh the home page to see them."
      );
    } catch (err) {
      setIoError(err instanceof Error ? err.message : "Could not import this file.");
    } finally {
      e.target.value = ""; // allow re-importing the same file
    }
    void pushIfSignedIn();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Add or update your free-tier API keys, and define custom OpenAI-compatible models.
        </p>
      </div>

      <SyncBanner state={sync} flash={syncFlash} />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">API keys</h2>
        <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
          Keys are stored only in this browser&apos;s localStorage. They never leave your machine
          except when sent to the chosen provider.
        </p>
        <div className="space-y-3">
          {KNOWN_PROVIDERS.map((p) => (
            <div key={p}>
              <label className="block text-sm font-medium">
                {PROVIDER_KEY_NAMES[p] ?? p}{" "}
                {PROVIDER_SIGNUP_URLS[p] && (
                  <a
                    href={PROVIDER_SIGNUP_URLS[p]}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-normal text-blue-600 hover:underline dark:text-blue-400"
                  >
                    (get a free key)
                  </a>
                )}
              </label>
              <input
                type="password"
                value={keys[p] ?? ""}
                onChange={(e) => setKeys({ ...keys, [p]: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 font-mono text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-900/40"
                placeholder={`Paste your ${p} key`}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handleSaveKeys}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            Save keys
          </button>
          {savedFlash && <span className="text-xs text-green-600 dark:text-green-400">Saved.</span>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Move keys to another computer</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Export everything (keys + custom models + selections) into a single JSON file, then
          import it on another browser or computer. Useful when you want to use the site from
          a second machine without re-typing keys.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={handleExport}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            Export to file
          </button>
          <label className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            Import from file
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
        </div>
        {ioMessage && (
          <p className="mt-3 rounded bg-green-50 p-2 text-xs text-green-800 dark:bg-green-950/40 dark:text-green-300">{ioMessage}</p>
        )}
        {ioError && (
          <p className="mt-3 rounded bg-red-50 p-2 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300">{ioError}</p>
        )}
        <p className="mt-3 rounded bg-yellow-50 p-2 text-xs text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300">
          ⚠ The exported file contains your API keys in <strong>plain text</strong>. Save it
          somewhere private (e.g. a password manager attachment), and don&apos;t email or
          message it.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-1 text-base font-semibold text-slate-900 dark:text-slate-100">Add a custom model</h2>
        <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
          For any provider that uses an OpenAI-compatible API. Examples below.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Display label</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-900/40"
              placeholder="e.g. DeepSeek V3 (direct)"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Provider name</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-900/40"
              placeholder="e.g. deepseek"
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Base URL</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 font-mono text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-900/40"
              placeholder="https://api.deepseek.com/v1"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Model ID</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 font-mono text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-900/40"
              placeholder="deepseek-chat"
              value={form.modelId}
              onChange={(e) => setForm({ ...form, modelId: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">API key (optional, saved for this provider)</label>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 font-mono text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-900/40"
              autoComplete="off"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            />
          </div>
        </div>
        <button
          onClick={handleAddCustom}
          className="mt-3 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          Add custom model
        </button>

        <details className="mt-4 text-xs text-slate-600 dark:text-slate-400">
          <summary className="cursor-pointer">Examples of OpenAI-compatible providers</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>DeepSeek direct — base URL <code>https://api.deepseek.com/v1</code>, model <code>deepseek-chat</code></li>
            <li>Mistral — base URL <code>https://api.mistral.ai/v1</code>, model <code>mistral-small-latest</code></li>
            <li>Together AI — base URL <code>https://api.together.xyz/v1</code></li>
            <li>Any local LLM with an OpenAI-compatible endpoint (LM Studio, llama.cpp server)</li>
          </ul>
        </details>
      </section>

      {custom.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">Your custom models</h2>
          <ul className="space-y-2">
            {custom.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded border border-slate-200 p-2 text-sm dark:border-slate-700"
              >
                <span>
                  <span className="font-medium">{m.label}</span>{" "}
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    ({m.provider} · {m.modelId})
                  </span>
                </span>
                <button
                  onClick={() => handleRemoveCustom(m.id)}
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sync.status === "signed-in" && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-1 text-base font-semibold text-slate-900 dark:text-slate-100">Verification history</h2>
          {historyCount !== null && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {historyCount} saved {historyCount === 1 ? "run" : "runs"} (max 50).{" "}
              <Link href="/history" className="text-blue-600 hover:underline dark:text-blue-400">
                Browse →
              </Link>
            </p>
          )}
          <p className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
            Sessions include the legal documents you uploaded. They are stored to your account on
            Upstash and visible from any device signed in with this email. Delete entries
            individually on the{" "}
            <Link href="/history" className="text-blue-600 hover:underline dark:text-blue-400">
              History page
            </Link>
            , or clear all below.
          </p>
          <button
            onClick={async () => {
              const ok = await toast.confirm("Delete all history entries? This cannot be undone.");
              if (!ok) return;
              const res = await clearHistory();
              if (!res.ok) { toast.show("error", "Could not clear history."); return; }
              setHistoryCount(0);
              toast.show("success", `Cleared ${res.deleted} ${res.deleted === 1 ? "entry" : "entries"}.`);
            }}
            className="mt-3 rounded-md border border-rose-300 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30"
          >
            Clear all history
          </button>
        </section>
      )}
    </div>
  );
}

function SyncBanner({ state, flash }: { state: SyncState; flash: string }) {
  if (state.status === "checking") {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
        Checking sync status…
      </div>
    );
  }
  if (state.status === "signed-in") {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-800 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-300">
        ✓ Signed in. Your keys, custom models, prompt edits, and role assignments
        sync to your account on every save.
        {flash && <span className="ml-2 font-medium">{flash}</span>}
        {state.lastSyncedAt && !flash && (
          <span className="ml-2 text-slate-500 dark:text-slate-400">
            Last synced {new Date(state.lastSyncedAt).toLocaleString()}.
          </span>
        )}
      </div>
    );
  }
  if (state.status === "signed-out") {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
        ⓘ Not signed in. Settings are saved only in this browser.{" "}
        <a href="/login" className="font-medium underline">
          Sign in
        </a>{" "}
        to sync them across devices.
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
        Sync error: {state.message}
      </div>
    );
  }
  return null;
}
