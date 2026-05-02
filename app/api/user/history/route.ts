import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import {
  isKvConfigured,
  getHistoryIndex,
  appendSession,
  deleteAllSessions,
  type Session,
} from "@/lib/auth/kv-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_MAX_BYTES = 4_000_000;

export async function GET() {
  if (!isKvConfigured()) {
    return NextResponse.json({ error: "Sync is not configured." }, { status: 503 });
  }
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  try {
    const sessions = await getHistoryIndex(session.email);
    return NextResponse.json({ sessions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to read";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isKvConfigured()) {
    return NextResponse.json({ error: "Sync is not configured." }, { status: 503 });
  }
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const raw = await req.text();
  if (raw.length > SESSION_MAX_BYTES) {
    return NextResponse.json({ error: "Session too large (max 4 MB)" }, { status: 413 });
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
    const id = await appendSession(session.email, body as Omit<Session, "id" | "createdAt">);
    return NextResponse.json({ id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  if (!isKvConfigured()) {
    return NextResponse.json({ error: "Sync is not configured." }, { status: 503 });
  }
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  try {
    const deleted = await deleteAllSessions(session.email);
    return NextResponse.json({ ok: true, deleted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to clear";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
