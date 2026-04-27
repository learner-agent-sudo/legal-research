import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { getUserData, isKvConfigured, setUserData, type UserDataBlob } from "@/lib/auth/kv-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isKvConfigured()) {
    return NextResponse.json({ error: "Sync is not configured." }, { status: 503 });
  }
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  try {
    const data = (await getUserData(session.email)) ?? {};
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to read";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!isKvConfigured()) {
    return NextResponse.json({ error: "Sync is not configured." }, { status: 503 });
  }
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  const blob: UserDataBlob = body as UserDataBlob;
  // ~512 KB sanity cap so a paste accident can't fill the cache
  const size = JSON.stringify(blob).length;
  if (size > 512 * 1024) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  try {
    await setUserData(session.email, blob);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to write";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
