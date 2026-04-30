import { Redis } from "@upstash/redis";

export type UserKeys = Record<string, string>;
export type UserCustomModels = unknown[];

const ttlSeconds = {
  otp: 10 * 60, // 10 minutes
  otpAttempts: 10 * 60,
};

let cached: Redis | null = null;

function resolveRedisEnv() {
  // Support both env-var naming conventions Vercel may inject:
  // - KV_REST_API_URL / KV_REST_API_TOKEN  (legacy KV connector)
  // - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN  (Upstash marketplace)
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";
  const token =
    process.env.KV_REST_API_TOKEN ??
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    "";
  return { url, token };
}

export function isKvConfigured(): boolean {
  const { url, token } = resolveRedisEnv();
  return Boolean(url && token);
}

function client(): Redis {
  if (cached) return cached;
  const { url, token } = resolveRedisEnv();
  if (!url || !token) {
    throw new Error(
      "Redis is not configured. Connect an Upstash Redis database to this Vercel project."
    );
  }
  cached = new Redis({ url, token });
  return cached;
}

function emailKey(email: string): string {
  return email.trim().toLowerCase();
}

// ---------- OTP storage ----------

export async function setOtp(email: string, codeHash: string): Promise<void> {
  const r = client();
  await r.set(`otp:${emailKey(email)}`, codeHash, { ex: ttlSeconds.otp });
  await r.set(`otp:attempts:${emailKey(email)}`, 0, { ex: ttlSeconds.otpAttempts });
}

export async function getOtp(email: string): Promise<string | null> {
  return await client().get<string>(`otp:${emailKey(email)}`);
}

export async function clearOtp(email: string): Promise<void> {
  const r = client();
  await r.del(`otp:${emailKey(email)}`);
  await r.del(`otp:attempts:${emailKey(email)}`);
}

export async function incrementOtpAttempts(email: string): Promise<number> {
  return await client().incr(`otp:attempts:${emailKey(email)}`);
}

// ---------- User key storage ----------

export async function getUserKeys(email: string): Promise<UserKeys | null> {
  return await client().get<UserKeys>(`user:${emailKey(email)}:keys`);
}

export async function setUserKeys(email: string, keys: UserKeys): Promise<void> {
  await client().set(`user:${emailKey(email)}:keys`, keys);
}

export async function getUserCustomModels(email: string): Promise<UserCustomModels | null> {
  return await client().get<UserCustomModels>(`user:${emailKey(email)}:custom-models`);
}

export async function setUserCustomModels(
  email: string,
  models: UserCustomModels
): Promise<void> {
  await client().set(`user:${emailKey(email)}:custom-models`, models);
}

// ---------- Unified per-user data blob ----------
//
// Stores everything we want to sync across devices in one Redis key:
//   user:<email>:data
//
// Keeping it in one blob avoids racey multi-key reads/writes for the
// single-user case and makes the wire protocol trivial.

export type UserDataBlob = {
  apiKeys?: Record<string, string>;
  customModels?: unknown[];
  promptOverrides?: Record<string, string>;
  modelRoles?: Record<string, string>;
  updatedAt?: string;
};

export async function getUserData(email: string): Promise<UserDataBlob | null> {
  return await client().get<UserDataBlob>(`user:${emailKey(email)}:data`);
}

export async function setUserData(email: string, data: UserDataBlob): Promise<void> {
  await client().set(`user:${emailKey(email)}:data`, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

// ---------- History storage ----------

export type SessionModelSnapshot = {
  id: string;
  label: string;
  role: string;
  promptUsed: string;
};

export type SessionResult = {
  modelId: string;
  modelLabel: string;
  role: string;
  status: "ok" | "error" | "deeplink";
  text?: string;
  verdict?: "green" | "yellow" | "red" | "none";
  error?: string;
};

export type SessionAdjudication = {
  challengerId: string;       // matches a SessionResult.modelId
  adjudicatorId: string;
  adjudicatorLabel: string;
  status: "ok" | "error";
  text?: string;
  verdict?: "green" | "yellow" | "red" | "none";
  error?: string;
};

export type Session = {
  id: string;
  createdAt: string;
  userQuestion: string;
  claudeAnswer: string;
  documentText: string;
  documentFilename: string;
  documentTruncated?: boolean;
  selectedModels: SessionModelSnapshot[];
  results: SessionResult[];
  adjudications?: SessionAdjudication[];
};

export type SessionSummary = {
  id: string;
  createdAt: string;
  questionPreview: string;
  modelCount: number;
  verdictCounts: { green: number; yellow: number; red: number; none: number };
};

const HISTORY_CAP = 50;
const SESSION_DOC_MAX = 30_000;

export async function getHistoryIndex(email: string): Promise<SessionSummary[]> {
  return (await client().get<SessionSummary[]>(`user:${emailKey(email)}:history-index`)) ?? [];
}

export async function setHistoryIndex(email: string, list: SessionSummary[]): Promise<void> {
  await client().set(`user:${emailKey(email)}:history-index`, list);
}

export async function getSession(email: string, id: string): Promise<Session | null> {
  return await client().get<Session>(`user:${emailKey(email)}:session:${id}`);
}

export async function setSession(email: string, session: Session): Promise<void> {
  await client().set(`user:${emailKey(email)}:session:${session.id}`, session);
}

export async function deleteSessionById(email: string, id: string): Promise<void> {
  const r = client();
  await r.del(`user:${emailKey(email)}:session:${id}`);
  const index = await getHistoryIndex(email);
  await setHistoryIndex(email, index.filter((s) => s.id !== id));
}

export async function deleteAllSessions(email: string): Promise<number> {
  const index = await getHistoryIndex(email);
  const r = client();
  await Promise.all(index.map((s) => r.del(`user:${emailKey(email)}:session:${s.id}`)));
  await r.del(`user:${emailKey(email)}:history-index`);
  return index.length;
}

export async function replaceSession(
  email: string,
  id: string,
  patch: Omit<Session, "id" | "createdAt">
): Promise<boolean> {
  const existing = await getSession(email, id);
  if (!existing) return false;

  let documentText = patch.documentText;
  let documentTruncated = patch.documentTruncated ?? false;
  if (documentText.length > SESSION_DOC_MAX) {
    documentText = documentText.slice(0, SESSION_DOC_MAX);
    documentTruncated = true;
  }

  const full: Session = {
    ...patch,
    id,
    createdAt: existing.createdAt,
    documentText,
    documentTruncated,
  };

  // Rebuild the summary so verdict counts in the index stay accurate
  const verdictCounts = { green: 0, yellow: 0, red: 0, none: 0 };
  for (const r of full.results) {
    const v = (r.verdict ?? "none") as keyof typeof verdictCounts;
    verdictCounts[v] = (verdictCounts[v] ?? 0) + 1;
  }
  const summary: SessionSummary = {
    id,
    createdAt: existing.createdAt,
    questionPreview: (full.userQuestion || full.claudeAnswer).slice(0, 120),
    modelCount: full.selectedModels.length,
    verdictCounts,
  };

  await setSession(email, full);

  const index = await getHistoryIndex(email);
  const next = index.map((s) => (s.id === id ? summary : s));
  await setHistoryIndex(email, next);
  return true;
}

export async function appendSession(
  email: string,
  session: Omit<Session, "id" | "createdAt">
): Promise<string> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  let documentText = session.documentText;
  let documentTruncated = false;
  if (documentText.length > SESSION_DOC_MAX) {
    documentText = documentText.slice(0, SESSION_DOC_MAX);
    documentTruncated = true;
  }

  const full: Session = { ...session, id, createdAt, documentText, documentTruncated };

  const verdictCounts = { green: 0, yellow: 0, red: 0, none: 0 };
  for (const r of full.results) {
    const v = (r.verdict ?? "none") as keyof typeof verdictCounts;
    verdictCounts[v] = (verdictCounts[v] ?? 0) + 1;
  }

  const summary: SessionSummary = {
    id,
    createdAt,
    questionPreview: (full.userQuestion || full.claudeAnswer).slice(0, 120),
    modelCount: full.selectedModels.length,
    verdictCounts,
  };

  await setSession(email, full);

  let index = await getHistoryIndex(email);
  index = [summary, ...index];
  if (index.length > HISTORY_CAP) {
    const evicted = index.splice(HISTORY_CAP);
    const r = client();
    await Promise.all(evicted.map((s) => r.del(`user:${emailKey(email)}:session:${s.id}`)));
  }
  await setHistoryIndex(email, index);

  return id;
}
