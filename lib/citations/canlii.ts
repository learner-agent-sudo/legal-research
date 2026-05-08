/**
 * CanLII API client (server-side only — no CORS headers on the CanLII API).
 *
 * API reference: https://api.canlii.org/
 * All calls require ?api_key=... query parameter.
 *
 * Fail-safe: every exported function returns a typed result union rather than
 * throwing, so a missing/expired key degrades gracefully in the UI.
 */

const CANLII_BASE = "https://api.canlii.org/v1";

// ── Type definitions ──────────────────────────────────────────────────────────

export type CanLIIError =
  | "no-key"          // api key not configured
  | "auth-error"      // 401/403 — invalid or expired key
  | "not-found"       // 404
  | "network-error"   // fetch failed / timeout
  | "parse-error"     // unexpected response shape
  | "not-supported";  // jurisdiction not in CanLII (e.g. HK)

export type CanLIILegislationHit = {
  title: string;
  citation: string;
  url: string;
  databaseId: string;
  legislationId: string;
};

export type CanLIICaseHit = {
  title: string;
  citation: string;
  url: string;
  databaseId: string;
  caseId: string;
  decisionDate?: string;
  court?: string;
};

export type CanLIIResult<T> =
  | { ok: true; hits: T[]; totalCount: number }
  | { ok: false; errorKind: CanLIIError; message: string };

// ── Jurisdiction mapping ──────────────────────────────────────────────────────

/** Jurisdiction codes recognised by CanLII (Canadian only). */
export const CANLII_JURISDICTION_CODES: Record<string, string> = {
  ontario:          "on",
  federal:          "ca",
  canada:           "ca",
  "british columbia": "bc",
  alberta:          "ab",
  quebec:           "qc",
  "nova scotia":    "ns",
  "new brunswick":  "nb",
  manitoba:         "mb",
  saskatchewan:     "sk",
  "prince edward island": "pe",
  newfoundland:     "nl",
  "northwest territories": "nt",
  nunavut:          "nu",
  yukon:            "yk",
};

/** Returns null when the jurisdiction is outside Canada (e.g. "hk"). */
export function toCanLIIJurisdiction(jurisdiction: string): string | null {
  const code = CANLII_JURISDICTION_CODES[jurisdiction.toLowerCase().trim()];
  return code ?? null;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

type FetchResult<T> = CanLIIResult<T>;

async function canliiFetch<T>(
  path: string,
  apiKey: string,
  parse: (json: unknown) => T[]
): Promise<FetchResult<T>> {
  if (!apiKey?.trim()) {
    return { ok: false, errorKind: "no-key", message: "No CanLII API key configured. Add one in Settings." };
  }

  const url = `${CANLII_BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(apiKey)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    return {
      ok: false,
      errorKind: "network-error",
      message: `CanLII network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      errorKind: "auth-error",
      message: "CanLII API key is invalid or has expired. Update it in Settings.",
    };
  }
  if (res.status === 404) {
    return { ok: false, errorKind: "not-found", message: "CanLII: resource not found (404)." };
  }
  if (!res.ok) {
    return {
      ok: false,
      errorKind: "network-error",
      message: `CanLII returned HTTP ${res.status}.`,
    };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, errorKind: "parse-error", message: "CanLII returned non-JSON response." };
  }

  try {
    const hits = parse(json);
    const total = (json as Record<string, unknown>)?.resultInfo
      ? ((json as { resultInfo?: { totalCount?: number } }).resultInfo?.totalCount ?? hits.length)
      : hits.length;
    return { ok: true, hits, totalCount: total };
  } catch (err) {
    return {
      ok: false,
      errorKind: "parse-error",
      message: `CanLII response parse error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ── Legislation search ────────────────────────────────────────────────────────

type RawLegResult = {
  databaseId?: string;
  legislationId?: string;
  title?: string;
  citation?: string;
  url?: string;
};

function parseLegislationHits(json: unknown): CanLIILegislationHit[] {
  const results = (json as { results?: RawLegResult[] })?.results;
  if (!Array.isArray(results)) return [];
  return results
    .filter((r): r is Required<RawLegResult> =>
      Boolean(r.databaseId && r.legislationId && r.title)
    )
    .map((r) => ({
      title: r.title,
      citation: r.citation ?? "",
      url: r.url ?? `https://www.canlii.org/en/${r.databaseId}/laws/`,
      databaseId: r.databaseId,
      legislationId: r.legislationId,
    }));
}

/**
 * Search CanLII for legislation matching the given name.
 * jurisdictionCode: e.g. "on" for Ontario, "ca" for federal.
 */
export async function searchCanLIILegislation(
  query: string,
  jurisdictionCode: string,
  apiKey: string
): Promise<CanLIIResult<CanLIILegislationHit>> {
  const q = encodeURIComponent(query.trim());
  const path = `/legislationBrowse/en/?text=${q}&jurisdiction=${jurisdictionCode}`;
  const result = await canliiFetch(path, apiKey, parseLegislationHits);
  // Fallback: search without jurisdiction filter if no results
  if (result.ok && result.hits.length === 0) {
    const broader = `/legislationBrowse/en/?text=${q}`;
    return canliiFetch(broader, apiKey, parseLegislationHits);
  }
  return result;
}

// ── Case search ───────────────────────────────────────────────────────────────

type RawCaseResult = {
  databaseId?: string;
  caseId?: string;
  title?: string;
  citation?: string;
  url?: string;
  decisionDate?: string;
  court?: { name?: string };
};

function parseCaseHits(json: unknown): CanLIICaseHit[] {
  const results = (json as { results?: RawCaseResult[] })?.results;
  if (!Array.isArray(results)) return [];
  return results
    .filter((r): r is RawCaseResult & { databaseId: string; caseId: string; title: string } =>
      Boolean(r.databaseId && r.caseId && r.title)
    )
    .map((r) => ({
      title: r.title,
      citation: r.citation ?? "",
      url: r.url ?? `https://www.canlii.org/en/${r.databaseId}/`,
      databaseId: r.databaseId!,
      caseId: r.caseId!,
      decisionDate: r.decisionDate,
      court: r.court?.name,
    }));
}

/**
 * Search CanLII for cases matching the query.
 * jurisdictionCode: e.g. "on", "ca". Pass undefined to search all.
 */
export async function searchCanLIICases(
  query: string,
  jurisdictionCode: string | undefined,
  apiKey: string
): Promise<CanLIIResult<CanLIICaseHit>> {
  const q = encodeURIComponent(query.trim());
  const jq = jurisdictionCode ? `&jurisdiction=${jurisdictionCode}` : "";
  const path = `/caseBrowse/en/?text=${q}${jq}`;
  return canliiFetch(path, apiKey, parseCaseHits);
}
