import type { ModelPreset } from "./presets";
import type { PromptOverrides, VerificationRole } from "./prompts";

const KEYS_STORAGE = "lr.apiKeys.v1";
const CUSTOM_MODELS_STORAGE = "lr.customModels.v1";
const SELECTED_MODELS_STORAGE = "lr.selectedModels.v1";
const ROLES_STORAGE = "lr.modelRoles.v1";
const DRAFT_STORAGE = "lr.draft.v1";
const GROUP_STATE_STORAGE = "lr.groupState.v1";
const PROMPT_OVERRIDES_STORAGE = "lr.promptOverrides.v1";

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

export type Draft = {
  userQuestion: string;
  claudeAnswer: string;
  documentText: string;
  docFileName: string;
};

export function loadDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DRAFT_STORAGE, JSON.stringify(draft));
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DRAFT_STORAGE);
}

export type GroupState = Record<string, boolean>;

export function loadGroupState(): GroupState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(GROUP_STATE_STORAGE);
    return raw ? (JSON.parse(raw) as GroupState) : {};
  } catch {
    return {};
  }
}

export function saveGroupState(state: GroupState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GROUP_STATE_STORAGE, JSON.stringify(state));
}

export function loadPromptOverrides(): PromptOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PROMPT_OVERRIDES_STORAGE);
    return raw ? (JSON.parse(raw) as PromptOverrides) : {};
  } catch {
    return {};
  }
}

export function savePromptOverrides(overrides: PromptOverrides) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROMPT_OVERRIDES_STORAGE, JSON.stringify(overrides));
}

export function clearPromptOverride(role: VerificationRole) {
  const all = loadPromptOverrides();
  delete all[role];
  savePromptOverrides(all);
}

export type ExportedConfig = {
  version: 1;
  exportedAt: string;
  apiKeys: ApiKeyMap;
  customModels: ModelPreset[];
  selectedModels: string[];
  modelRoles: RoleMap;
  groupState: GroupState;
  promptOverrides?: PromptOverrides;
};

export function exportConfig(): ExportedConfig {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    apiKeys: loadApiKeys(),
    customModels: loadCustomModels(),
    selectedModels: loadSelectedModels(),
    modelRoles: loadModelRoles(),
    groupState: loadGroupState(),
    promptOverrides: loadPromptOverrides(),
  };
}

export type ImportSummary = {
  apiKeys: number;
  customModels: number;
  selectedModels: number;
  modelRoles: number;
  groupState: number;
  promptOverrides: number;
};

export function importConfig(raw: unknown): ImportSummary {
  if (!raw || typeof raw !== "object") {
    throw new Error("Imported file is not valid JSON.");
  }
  const cfg = raw as Partial<ExportedConfig>;
  if (cfg.version !== 1) {
    throw new Error(`Unknown config version: ${String(cfg.version)}.`);
  }

  const summary: ImportSummary = {
    apiKeys: 0,
    customModels: 0,
    selectedModels: 0,
    modelRoles: 0,
    groupState: 0,
    promptOverrides: 0,
  };

  if (cfg.apiKeys && typeof cfg.apiKeys === "object") {
    saveApiKeys(cfg.apiKeys);
    summary.apiKeys = Object.keys(cfg.apiKeys).length;
  }
  if (Array.isArray(cfg.customModels)) {
    saveCustomModels(cfg.customModels);
    summary.customModels = cfg.customModels.length;
  }
  if (Array.isArray(cfg.selectedModels)) {
    saveSelectedModels(cfg.selectedModels);
    summary.selectedModels = cfg.selectedModels.length;
  }
  if (cfg.modelRoles && typeof cfg.modelRoles === "object") {
    saveModelRoles(cfg.modelRoles);
    summary.modelRoles = Object.keys(cfg.modelRoles).length;
  }
  if (cfg.groupState && typeof cfg.groupState === "object") {
    saveGroupState(cfg.groupState);
    summary.groupState = Object.keys(cfg.groupState).length;
  }
  if (cfg.promptOverrides && typeof cfg.promptOverrides === "object") {
    savePromptOverrides(cfg.promptOverrides);
    summary.promptOverrides = Object.keys(cfg.promptOverrides).length;
  }
  return summary;
}
