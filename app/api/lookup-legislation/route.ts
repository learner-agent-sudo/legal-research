import { NextRequest, NextResponse } from "next/server";
import { findOntarioAct } from "@/lib/citations/ontario-acts";
import { fetchOntarioSection } from "@/lib/citations/ontario-parser";
import { findHkCap } from "@/lib/citations/hk-caps";
import { fetchHkSection } from "@/lib/citations/hk-parser";

export const runtime = "nodejs";
// Cache fetched sections for 7 days (legislation rarely changes mid-year)
export const revalidate = 604800;

export type LookupRequest = {
  jurisdiction: "ontario" | "hk";
  act: string;             // e.g. "Employment Standards Act, 2000" / "Employment Ordinance"
  section: string;         // e.g. "14(2)" / "9(1)"
  actCode?: string;        // optional override (Ontario: e-Laws code; HK: cap number)
};

export type LookupResponse =
  | { ok: true;  found: true;  actName: string; actCode: string; section: string; text: string; url: string }
  | { ok: true;  found: false; actName: string; actCode: string | null; reason: string; url: string | null; debug?: unknown }
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

  // ── Ontario ──────────────────────────────────────────────────────────────
  if (jurisdiction === "ontario") {
    const actCode = codeOverride ?? findOntarioAct(act)?.code ?? null;
    if (!actCode) {
      return NextResponse.json({
        ok: true, found: false, actName: act, actCode: null,
        reason: `Could not find "${act}" in the Ontario acts index. Try specifying actCode directly, or check the act name spelling.`,
        url: null,
      });
    }
    const result = await fetchOntarioSection(actCode, section);
    if (!result.found) {
      return NextResponse.json({
        ok: true, found: false, actName: act, actCode,
        reason: result.reason, url: result.url, debug: result.debug,
      });
    }
    return NextResponse.json({
      ok: true, found: true, actName: act, actCode, section, text: result.text, url: result.url,
    });
  }

  // ── Hong Kong ─────────────────────────────────────────────────────────────
  if (jurisdiction === "hk") {
    const cap = codeOverride ?? findHkCap(act)?.cap ?? null;
    if (!cap) {
      return NextResponse.json({
        ok: true, found: false, actName: act, actCode: null,
        reason: `Could not find "${act}" in the HK caps index. Try specifying actCode as the Cap number (e.g. "57"), or check the ordinance name spelling.`,
        url: null,
      });
    }
    const result = await fetchHkSection(cap, section);
    if (!result.found) {
      return NextResponse.json({
        ok: true, found: false, actName: act, actCode: cap,
        reason: result.reason, url: result.url, debug: result.debug,
      });
    }
    return NextResponse.json({
      ok: true, found: true, actName: act, actCode: cap, section, text: result.text, url: result.url,
    });
  }

  return NextResponse.json(
    { ok: false, error: `Jurisdiction "${jurisdiction}" is not supported. Use "ontario" or "hk".` },
    { status: 400 }
  );
}
