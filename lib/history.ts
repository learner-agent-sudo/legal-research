import type { Session, SessionSummary } from "@/lib/auth/kv-store";

export type { Session, SessionSummary };

export type HistoryResult =
  | { ok: true; sessions: SessionSummary[] }
  | { ok: false; reason: "not-signed-in" | "not-configured" | "network" | "error"; message?: string };

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not-signed-in" | "not-configured" | "too-large" | "network" | "error"; message?: string };

export type LoadResult =
  | { ok: true; session: Session }
  | { ok: false; reason: "not-signed-in" | "not-configured" | "not-found" | "network" | "error"; message?: string };

export type DeleteResult =
  | { ok: true }
  | { ok: false; reason: "not-signed-in" | "not-configured" | "network" | "error"; message?: string };

export type ClearResult =
  | { ok: true; deleted: number }
  | { ok: false; reason: "not-signed-in" | "not-configured" | "network" | "error"; message?: string };

export async function listSessions(): Promise<HistoryResult> {
  try {
    const res = await fetch("/api/user/history");
    if (res.status === 401) return { ok: false, reason: "not-signed-in" };
    if (res.status === 503) return { ok: false, reason: "not-configured" };
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, reason: "error", message: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const json = (await res.json()) as { sessions: SessionSummary[] };
    return { ok: true, sessions: json.sessions };
  } catch (err) {
    return { ok: false, reason: "network", message: err instanceof Error ? err.message : "network error" };
  }
}

export async function saveSession(
  session: Omit<Session, "id" | "createdAt">
): Promise<SaveResult> {
  try {
    const body = JSON.stringify(session);
    const res = await fetch("/api/user/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (res.status === 401) return { ok: false, reason: "not-signed-in" };
    if (res.status === 503) return { ok: false, reason: "not-configured" };
    if (res.status === 413) return { ok: false, reason: "too-large", message: "Session too large (max 500 KB)" };
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, reason: "error", message: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const json = (await res.json()) as { id: string };
    return { ok: true, id: json.id };
  } catch (err) {
    return { ok: false, reason: "network", message: err instanceof Error ? err.message : "network error" };
  }
}

export async function loadSession(id: string): Promise<LoadResult> {
  try {
    const res = await fetch(`/api/user/history/${id}`);
    if (res.status === 401) return { ok: false, reason: "not-signed-in" };
    if (res.status === 503) return { ok: false, reason: "not-configured" };
    if (res.status === 404) return { ok: false, reason: "not-found" };
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, reason: "error", message: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const json = (await res.json()) as { session: Session };
    return { ok: true, session: json.session };
  } catch (err) {
    return { ok: false, reason: "network", message: err instanceof Error ? err.message : "network error" };
  }
}

export async function updateSession(
  id: string,
  session: Omit<Session, "id" | "createdAt">
): Promise<SaveResult> {
  try {
    const body = JSON.stringify(session);
    const res = await fetch(`/api/user/history/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (res.status === 401) return { ok: false, reason: "not-signed-in" };
    if (res.status === 503) return { ok: false, reason: "not-configured" };
    if (res.status === 413) return { ok: false, reason: "too-large", message: "Session too large (max 500 KB)" };
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, reason: "error", message: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true, id };
  } catch (err) {
    return { ok: false, reason: "network", message: err instanceof Error ? err.message : "network error" };
  }
}

export async function deleteSession(id: string): Promise<DeleteResult> {
  try {
    const res = await fetch(`/api/user/history/${id}`, { method: "DELETE" });
    if (res.status === 401) return { ok: false, reason: "not-signed-in" };
    if (res.status === 503) return { ok: false, reason: "not-configured" };
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, reason: "error", message: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: "network", message: err instanceof Error ? err.message : "network error" };
  }
}

export async function clearHistory(): Promise<ClearResult> {
  try {
    const res = await fetch("/api/user/history", { method: "DELETE" });
    if (res.status === 401) return { ok: false, reason: "not-signed-in" };
    if (res.status === 503) return { ok: false, reason: "not-configured" };
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, reason: "error", message: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const json = (await res.json()) as { deleted: number };
    return { ok: true, deleted: json.deleted };
  } catch (err) {
    return { ok: false, reason: "network", message: err instanceof Error ? err.message : "network error" };
  }
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatAbsoluteDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
