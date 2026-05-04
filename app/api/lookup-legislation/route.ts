import { NextRequest, NextResponse } from "next/server";
import { findOntarioAct } from "@/lib/citations/ontario-acts";
import { fetchOntarioSection } from "@/lib/citations/ontario-parser";

export const runtime = "nodejs";
// Cache fetched sections in the Vercel edge cache for 7 days
// (legislation rarely changes mid-year; revalidation is manual for now)
export const revalidate = 604800;

export type LookupRequest = {
  jurisdiction: "ontario"; // extend later for "hk"
  act: string;             // e.g. "Employment Standards Act, 2000"
  section: string;         // e.g. "14(2)"
  actCode?: string;        // optional override — skip name lookup
};

export type LookupResponse =
  | { ok: true;  found: true;  actName: string; actCode: string; section: string; text: string; url: string }
  | { ok: true;  found: false; actName: string; actCode: string | null; reason: string; url: string | null }
  | { ok: false; error: string };

export async function POST(req: NextRequest): Promise<NextResponse<LookupResponse>> {
  let body: LookupRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { jurisdiction, act, section, actCode: codeOverride } = body;

  if (!jurisdiction || !act || !section) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields: jurisdiction, act, section" },
      { status: 400 }
    );
  }

  if (jurisdiction !== "ontario") {
    return NextResponse.json(
      { ok: false, error: `Jurisdiction "${jurisdiction}" not yet supported. Only "ontario" is available.` },
      { status: 400 }
    );
  }

  // Resolve act code
  const actCode = codeOverride ?? findOntarioAct(act)?.code ?? null;
  if (!actCode) {
    return NextResponse.json({
      ok: true,
      found: false,
      actName: act,
      actCode: null,
      reason: `Could not find "${act}" in the Ontario acts index. Try specifying actCode directly, or check the act name spelling.`,
      url: null,
    });
  }

  const result = await fetchOntarioSection(actCode, section);

  if (!result.found) {
    return NextResponse.json({
      ok: true,
      found: false,
      actName: act,
      actCode,
      reason: result.reason,
      url: result.url,
    });
  }

  return NextResponse.json({
    ok: true,
    found: true,
    actName: act,
    actCode,
    section,
    text: result.text,
    url: result.url,
  });
}
