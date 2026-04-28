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

function hasMeaningfulLocalData(d: SyncableData): boolean {
  return Boolean(
    (d.apiKeys && Object.keys(d.apiKeys).length > 0) ||
      (d.customModels && d.customModels.length > 0) ||
      (d.promptOverrides && Object.keys(d.promptOverrides).length > 0) ||
      (d.modelRoles && Object.keys(d.modelRoles).length > 0)
  );
}

export type SmartSyncOutcome =
  | { ok: true; action: "pulled" | "migrated" | "noop"; data?: SyncableData }
  | {
      ok: false;
      reason: "not-signed-in" | "not-configured" | "network" | "error";
      message?: string;
    };

/**
 * Pull from server. If the server has data, write it to localStorage. If the
 * server is empty BUT localStorage has data, push localStorage up — useful
 * for the first login from a device that's been used while signed out.
 */
export async function smartSync(): Promise<SmartSyncOutcome> {
  const pull = await pullFromServer();
  if (!pull.ok) {
    return { ok: false, reason: pull.reason, message: pull.message };
  }

  const serverHasData = pull.data && Object.keys(pull.data).length > 0;
  if (serverHasData) {
    writeLocalSnapshot(pull.data!);
    return { ok: true, action: "pulled", data: pull.data };
  }

  const local = readLocalSnapshot();
  if (hasMeaningfulLocalData(local)) {
    const push = await pushToServer(local);
    if (!push.ok) {
      return { ok: false, reason: push.reason, message: push.message };
    }
    return { ok: true, action: "migrated" };
  }

  return { ok: true, action: "noop" };
}
