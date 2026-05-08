import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Pings the CanLII API with the given key to verify it works.
 * The lightest endpoint is /caseBrowse/en/ which returns the list of databases.
 *
 * Body: { apiKey: string }
 */
export async function POST(req: NextRequest) {
  let body: { apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const apiKey = body.apiKey?.trim();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "Missing apiKey in body" }, { status: 400 });
  }

  const t0 = Date.now();
  const url = `https://api.canlii.org/v1/caseBrowse/en/?api_key=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    const ms = Date.now() - t0;

    if (res.ok) {
      const json = (await res.json().catch(() => null)) as { caseDatabases?: unknown[] } | null;
      const dbCount = Array.isArray(json?.caseDatabases) ? json!.caseDatabases!.length : 0;
      return NextResponse.json({
        ok: true,
        ms,
        detail: `${res.status} OK · ${dbCount} case databases visible`,
      });
    }

    const text = await res.text().catch(() => "");
    return NextResponse.json({
      ok: false,
      ms,
      detail: `HTTP ${res.status}${text ? ` — ${text.slice(0, 200)}` : ""}`,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      ms: Date.now() - t0,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
