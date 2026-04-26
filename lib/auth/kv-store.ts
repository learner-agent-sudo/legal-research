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
