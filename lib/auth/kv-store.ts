import { kv } from "@vercel/kv";

export type UserKeys = Record<string, string>;
export type UserCustomModels = unknown[]; // ModelPreset[] but kept loose for storage layer

const ttlSeconds = {
  otp: 10 * 60, // 10 minutes
  otpAttempts: 10 * 60,
};

export function isKvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function emailKey(email: string): string {
  return email.trim().toLowerCase();
}

// ---------- OTP storage ----------

export async function setOtp(email: string, codeHash: string): Promise<void> {
  await kv.set(`otp:${emailKey(email)}`, codeHash, { ex: ttlSeconds.otp });
  await kv.set(`otp:attempts:${emailKey(email)}`, 0, { ex: ttlSeconds.otpAttempts });
}

export async function getOtp(email: string): Promise<string | null> {
  return await kv.get<string>(`otp:${emailKey(email)}`);
}

export async function clearOtp(email: string): Promise<void> {
  await kv.del(`otp:${emailKey(email)}`);
  await kv.del(`otp:attempts:${emailKey(email)}`);
}

export async function incrementOtpAttempts(email: string): Promise<number> {
  const next = await kv.incr(`otp:attempts:${emailKey(email)}`);
  return next;
}

// ---------- User key storage ----------

export async function getUserKeys(email: string): Promise<UserKeys | null> {
  return await kv.get<UserKeys>(`user:${emailKey(email)}:keys`);
}

export async function setUserKeys(email: string, keys: UserKeys): Promise<void> {
  await kv.set(`user:${emailKey(email)}:keys`, keys);
}

export async function getUserCustomModels(email: string): Promise<UserCustomModels | null> {
  return await kv.get<UserCustomModels>(`user:${emailKey(email)}:custom-models`);
}

export async function setUserCustomModels(email: string, models: UserCustomModels): Promise<void> {
  await kv.set(`user:${emailKey(email)}:custom-models`, models);
}
