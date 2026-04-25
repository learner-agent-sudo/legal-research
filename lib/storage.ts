import type { ModelPreset } from "./presets";

const KEYS_STORAGE = "lr.apiKeys.v1";
const CUSTOM_MODELS_STORAGE = "lr.customModels.v1";
const SELECTED_MODELS_STORAGE = "lr.selectedModels.v1";

export type ApiKeyMap = Record<string, string>;

export function loadApiKeys(): ApiKeyMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEYS_STORAGE);
    return raw ? (JSON.parse(raw) as ApiKeyMap) : {};
  } catch {
    return {};
  }
}

export function saveApiKeys(map: ApiKeyMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEYS_STORAGE, JSON.stringify(map));
}

export function loadCustomModels(): ModelPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_MODELS_STORAGE);
    return raw ? (JSON.parse(raw) as ModelPreset[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomModels(models: ModelPreset[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CUSTOM_MODELS_STORAGE, JSON.stringify(models));
}

export function loadSelectedModels(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SELECTED_MODELS_STORAGE);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveSelectedModels(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SELECTED_MODELS_STORAGE, JSON.stringify(ids));
}
