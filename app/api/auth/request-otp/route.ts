import { NextRequest, NextResponse } from "next/server";
import { isEmailAllowed } from "@/lib/auth/whitelist";
import { isKvConfigured, setOtp } from "@/lib/auth/kv-store";
import { sendOtpEmail } from "@/lib/auth/email";
import { generateOtp, hashOtp } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isKvConfigured()) {
    return NextResponse.json(
      { error: "Sign-in is not configured on this deployment." },
      { status: 503 }
    );
  }

  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (!isEmailAllowed(email)) {
    return NextResponse.json(
      { error: "This email is not authorized to sign in." },
      { status: 403 }
    );
  }

  try {
    const code = generateOtp();
    const codeHash = hashOtp(code, email);
    await setOtp(email, codeHash);
    const emailed = await sendOtpEmail(email, code);
    return NextResponse.json({ ok: true, emailed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send code";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
