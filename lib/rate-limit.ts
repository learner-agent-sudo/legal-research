import { incrementWindowCounter, isKvConfigured } from "@/lib/auth/kv-store";

// Used when Redis isn't connected (or can't be reached). Each server instance
// counts on its own, so this is a rough limit rather than an exact one.
const memory = new Map<string, { count: number; resetAt: number }>();

/**
 * Counts one request against `key`. Returns false once more than `limit`
 * requests have arrived in the current `windowSeconds` window.
 */
export async function allowRequest(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  if (isKvConfigured()) {
    try {
      return (await incrementWindowCounter(`ratelimit:${key}`, windowSeconds)) <= limit;
    } catch {
      // Fall through to the per-instance counter.
    }
  }
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    if (memory.size > 10_000) memory.clear();
    memory.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}
