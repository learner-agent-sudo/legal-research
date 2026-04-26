import type { ModelPreset } from "./presets";
import type { VerificationRole } from "./prompts";

const KEYS_STORAGE = "lr.apiKeys.v1";
const CUSTOM_MODELS_STORAGE = "lr.customModels.v1";
const SELECTED_MODELS_STORAGE = "lr.selectedModels.v1";
const ROLES_STORAGE = "lr.modelRoles.v1";

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

export type RoleMap = Record<string, VerificationRole>;

export function loadModelRoles(): RoleMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ROLES_STORAGE);
    return raw ? (JSON.parse(raw) as RoleMap) : {};
  } catch {
    return {};
  }
}

export function saveModelRoles(map: RoleMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ROLES_STORAGE, JSON.stringify(map));
}
