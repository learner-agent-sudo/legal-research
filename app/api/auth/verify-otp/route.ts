import { NextRequest, NextResponse } from "next/server";
import {
  clearOtp,
  getOtp,
  incrementOtpAttempts,
  isKvConfigured,
} from "@/lib/auth/kv-store";
import {
  constantTimeEqual,
  createSessionToken,
  hashOtp,
  setSessionCookie,
} from "@/lib/auth/session";
import { isEmailAllowed } from "@/lib/auth/whitelist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  if (!isKvConfigured()) {
    return NextResponse.json({ error: "Sign-in is not configured." }, { status: 503 });
  }

  let body: { email?: string; code?: string };
  try {
    body = (await req.json()) as { email?: string; code?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const code = body.code?.trim() ?? "";

  if (!email || !code) {
    return NextResponse.json({ error: "Email and code are required." }, { status: 400 });
  }
  if (!isEmailAllowed(email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const attempts = await incrementOtpAttempts(email);
  if (attempts > MAX_ATTEMPTS) {
    await clearOtp(email);
    return NextResponse.json(
      { error: "Too many attempts. Request a new code." },
      { status: 429 }
    );
  }

  const stored = await getOtp(email);
  if (!stored) {
    return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
  }

  const submitted = hashOtp(code, email);
  if (!constantTimeEqual(stored, submitted)) {
    return NextResponse.json({ error: "Wrong code." }, { status: 401 });
  }

  await clearOtp(email);
  try {
    const token = await createSessionToken(email);
    await setSessionCookie(token);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
