import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import {
  isKvConfigured,
  getSession,
  deleteSessionById,
  replaceSession,
  type Session,
} from "@/lib/auth/kv-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_MAX_BYTES = 500_000;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isKvConfigured()) {
    return NextResponse.json({ error: "Sync is not configured." }, { status: 503 });
  }
  const authSession = await getCurrentSession();
  if (!authSession) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;
  try {
    const data = await getSession(authSession.email, id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ session: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to read";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isKvConfigured()) {
    return NextResponse.json({ error: "Sync is not configured." }, { status: 503 });
  }
  const authSession = await getCurrentSession();
  if (!authSession) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;

  const raw = await req.text();
  if (raw.length > SESSION_MAX_BYTES) {
    return NextResponse.json({ error: "Session too large (max 500 KB)" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  try {
    const ok = await replaceSession(
      authSession.email,
      id,
      body as Omit<Session, "id" | "createdAt">
    );
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isKvConfigured()) {
    return NextResponse.json({ error: "Sync is not configured." }, { status: 503 });
  }
  const authSession = await getCurrentSession();
  if (!authSession) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;
  try {
    await deleteSessionById(authSession.email, id);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
