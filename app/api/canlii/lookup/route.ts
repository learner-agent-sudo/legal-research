import { NextRequest, NextResponse } from "next/server";
import {
  searchCanLIILegislation,
  searchCanLIICases,
  searchCanLIICasesByDb,
  toCanLIIJurisdiction,
} from "@/lib/citations/canlii";

export const runtime = "nodejs";

export type CanLIILookupRequest = {
  type: "legislation" | "case";
  query: string;
  jurisdiction?: string;   // e.g. "ontario", "federal" — optional
  databaseId?: string;     // e.g. "scc", "onca" — takes precedence over jurisdiction for case searches
  apiKey: string;
};

export async function POST(req: NextRequest) {
  let body: CanLIILookupRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { type, query, jurisdiction, databaseId, apiKey } = body;

  if (!type || !query || !apiKey?.trim()) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields: type, query, apiKey" },
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
