import { NextRequest, NextResponse } from "next/server";
import {
  searchCanLIILegislation,
  searchCanLIICases,
  searchCanLIICasesByDb,
  getCanLIICaseDetail,
  toCanLIIJurisdiction,
} from "@/lib/citations/canlii";

export const runtime = "nodejs";

export type CanLIILookupRequest = {
  type: "legislation" | "case" | "case-detail";
  query?: string;
  jurisdiction?: string;
  databaseId?: string;
  caseSlug?: string;       // for type="case-detail" — e.g. "2008scc39"
  apiKey: string;
};

export async function POST(req: NextRequest) {
  let body: CanLIILookupRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { type, query, jurisdiction, databaseId, caseSlug, apiKey } = body;

  if (!type || !apiKey?.trim()) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields: type, apiKey" },
      { status: 400 }
    );
  }

  if (type === "case-detail") {
    if (!databaseId || !caseSlug) {
      return NextResponse.json(
        { ok: false, error: "type=case-detail requires databaseId and caseSlug" },
        { status: 400 }
      );
    }
    const result = await getCanLIICaseDetail(databaseId, caseSlug, apiKey);
    return NextResponse.json(result);
  }

  if (!query) {
    return NextResponse.json(
      { ok: false, error: "Missing required field: query" },
      { status: 400 }
    );
  }

  // Resolve jurisdiction code (CanLII is Canada-only)
  let jurisdictionCode: string | undefined;
  if (jurisdiction) {
    const code = toCanLIIJurisdiction(jurisdiction);
    if (!code) {
      return NextResponse.json({
        ok: false,
        error: `Jurisdiction "${jurisdiction}" is not available on CanLII (Canadian courts only). `,
      });
    }
    jurisdictionCode = code;
  }

  if (type === "legislation") {
    const result = await searchCanLIILegislation(
      query,
      jurisdictionCode ?? "on",
      apiKey
    );
    return NextResponse.json(result);
  }

  if (type === "case") {
    if (databaseId) {
      const result = await searchCanLIICasesByDb(query, databaseId, apiKey);
      return NextResponse.json(result);
    }
    const result = await searchCanLIICases(query, jurisdictionCode, apiKey);
    return NextResponse.json(result);
  }

  return NextResponse.json(
    { ok: false, error: `Unknown type "${type}". Use "legislation" or "case".` },
    { status: 400 }
  );
}
