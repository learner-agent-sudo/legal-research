import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { isKvConfigured, getSession, deleteSessionById } from "@/lib/auth/kv-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
