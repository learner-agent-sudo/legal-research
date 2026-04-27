import {
  loadApiKeys,
  loadCustomModels,
  loadModelRoles,
  loadPromptOverrides,
  saveApiKeys,
  saveCustomModels,
  saveModelRoles,
  savePromptOverrides,
} from "./storage";
import type { ModelPreset } from "./presets";
import type { PromptOverrides, VerificationRole } from "./prompts";

export type SyncableData = {
  apiKeys?: Record<string, string>;
  customModels?: ModelPreset[];
  promptOverrides?: PromptOverrides;
  modelRoles?: Record<string, VerificationRole>;
  updatedAt?: string;
};

export type SyncResult =
  | { ok: true; data?: SyncableData }
  | { ok: false; reason: "not-signed-in" | "not-configured" | "network" | "error"; message?: string };

/** Build a snapshot of the current localStorage state for the syncable slices. */
export function readLocalSnapshot(): SyncableData {
  return {
    apiKeys: loadApiKeys(),
    customModels: loadCustomModels(),
    promptOverrides: loadPromptOverrides(),
    modelRoles: loadModelRoles() as Record<string, VerificationRole>,
  };
}

/** Write a snapshot from the server back into localStorage. */
export function writeLocalSnapshot(data: SyncableData) {
  if (data.apiKeys) saveApiKeys(data.apiKeys);
  if (data.customModels) saveCustomModels(data.customModels);
  if (data.promptOverrides) savePromptOverrides(data.promptOverrides);
  if (data.modelRoles) saveModelRoles(data.modelRoles);
}

export async function pullFromServer(): Promise<SyncResult> {
  try {
    const res = await fetch("/api/user/data");
    if (res.status === 401) return { ok: false, reason: "not-signed-in" };
    if (res.status === 503) return { ok: false, reason: "not-configured" };
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, reason: "error", message: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const json = (await res.json()) as { data?: SyncableData };
    return { ok: true, data: json.data ?? {} };
  } catch (err) {
    return {
      ok: false,
      reason: "network",
      message: err instanceof Error ? err.message : "network error",
    };
  }
}

export async function pushToServer(data: SyncableData): Promise<SyncResult> {
  try {
    const res = await fetch("/api/user/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.status === 401) return { ok: false, reason: "not-signed-in" };
    if (res.status === 503) return { ok: false, reason: "not-configured" };
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, reason: "error", message: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: "network",
      message: err instanceof Error ? err.message : "network error",
    };
  }
}

/** Convenience: snapshot localStorage and push to server. */
export async function pushSnapshot(): Promise<SyncResult> {
  return await pushToServer(readLocalSnapshot());
}
