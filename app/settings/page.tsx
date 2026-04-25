"use client";

import { useEffect, useState } from "react";
import {
  PROVIDER_KEY_NAMES,
  PROVIDER_SIGNUP_URLS,
  type ModelPreset,
} from "@/lib/presets";
import {
  loadApiKeys,
  loadCustomModels,
  saveApiKeys,
  saveCustomModels,
} from "@/lib/storage";

const KNOWN_PROVIDERS = ["groq", "openrouter", "gemini", "mistral"];

export default function SettingsPage() {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<ModelPreset[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);

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
  }, []);

  function handleSaveKeys() {
    saveApiKeys(keys);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  function handleAddCustom() {
    if (!form.label || !form.baseUrl || !form.modelId || !form.provider) {
      alert("Label, provider, base URL, and model ID are required.");
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
  }

  function handleRemoveCustom(id: string) {
    const next = custom.filter((m) => m.id !== id);
    setCustom(next);
    saveCustomModels(next);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold">API keys</h2>
        <p className="mb-3 text-xs text-slate-600">
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
                    className="text-xs font-normal text-blue-600 hover:underline"
                  >
                    (get a free key)
                  </a>
                )}
              </label>
              <input
                type="password"
                value={keys[p] ?? ""}
                onChange={(e) => setKeys({ ...keys, [p]: e.target.value })}
                className="mt-1 w-full rounded border p-2 font-mono text-sm"
                placeholder={`Paste your ${p} key`}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handleSaveKeys}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Save keys
          </button>
          {savedFlash && <span className="text-xs text-green-600">Saved.</span>}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-base font-semibold">Add a custom model</h2>
        <p className="mb-3 text-xs text-slate-600">
          For any provider that uses an OpenAI-compatible API. Examples below.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Display label</label>
            <input
              className="mt-1 w-full rounded border p-2 text-sm"
              placeholder="e.g. DeepSeek V3 (direct)"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Provider name</label>
            <input
              className="mt-1 w-full rounded border p-2 text-sm"
              placeholder="e.g. deepseek"
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Base URL</label>
            <input
              className="mt-1 w-full rounded border p-2 font-mono text-sm"
              placeholder="https://api.deepseek.com/v1"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Model ID</label>
            <input
              className="mt-1 w-full rounded border p-2 font-mono text-sm"
              placeholder="deepseek-chat"
              value={form.modelId}
              onChange={(e) => setForm({ ...form, modelId: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">API key (optional, saved for this provider)</label>
            <input
              type="password"
              className="mt-1 w-full rounded border p-2 font-mono text-sm"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            />
          </div>
        </div>
        <button
          onClick={handleAddCustom}
          className="mt-3 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add custom model
        </button>

        <details className="mt-4 text-xs text-slate-600">
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
        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold">Your custom models</h2>
          <ul className="space-y-2">
            {custom.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded border p-2 text-sm"
              >
                <span>
                  <span className="font-medium">{m.label}</span>{" "}
                  <span className="text-xs text-slate-500">
                    ({m.provider} · {m.modelId})
                  </span>
                </span>
                <button
                  onClick={() => handleRemoveCustom(m.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
