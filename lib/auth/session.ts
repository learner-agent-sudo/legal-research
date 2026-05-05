import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";

const COOKIE_NAME = "lr_session";
const SESSION_DAYS = 30;

/**
 * Returns a stable fallback secret when SESSION_SECRET is not configured.
 * Derived from VERCEL_URL (injected by Vercel, same value across all instances
 * of a deployment) so sessions survive across serverless invocations.
 * Sessions will be invalidated on each new Vercel deployment.
 * Set SESSION_SECRET in Vercel env vars for fully persistent sessions.
 */
function getFallbackSecret(): string {
  const seed =
    process.env.VERCEL_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    "local-dev-only";
  console.warn(
    "[auth] SESSION_SECRET is not set — using a derived fallback. " +
      "Sessions will reset on each new deployment. " +
      "Add SESSION_SECRET (32+ chars) in Vercel → Settings → Environment Variables."
  );
  return createHash("sha256").update("lr-session-v1:" + seed).digest("hex");
}

let _fallback: string | null = null;
function stableFallback(): string {
  if (!_fallback) _fallback = getFallbackSecret();
  return _fallback;
}

function getSecret(): Uint8Array {
  const raw = process.env.SESSION_SECRET?.trim();
  return new TextEncoder().encode(raw && raw.length >= 32 ? raw : stableFallback());
}

function getSecretOrNull(): Uint8Array | null {
  const raw = process.env.SESSION_SECRET?.trim();
  return new TextEncoder().encode(raw && raw.length >= 32 ? raw : stableFallback());
}

export type SessionPayload = {
  email: string;
};

export async function createSessionToken(email: string): Promise<string> {
  return await new SignJWT({ email: email.toLowerCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const secret = getSecretOrNull();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.email !== "string") return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getCurrentSession(): Promise<SessionPayload | null> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

// ---------- OTP helpers ----------

export function generateOtp(): string {
  // 6-digit code, zero-padded
  const buf = randomBytes(4);
  const num = buf.readUInt32BE(0) % 1_000_000;
  return num.toString().padStart(6, "0");
}

export function hashOtp(code: string, email: string): string {
  return createHash("sha256")
    .update(`${email.toLowerCase()}:${code}:${process.env.SESSION_SECRET ?? ""}`)
    .digest("hex");
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
