import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Probes multiple CanLII API endpoint shapes to figure out which ones work.
 * We try the same logical query several different ways so we can see which
 * paths return data, which 404, and which silently return empty results.
 *
 * Body: { apiKey: string, citation?: string }
 * Default citation: "2008 SCC 39" (Honda Canada Inc. v. Keays)
 */
type Probe = {
  label: string;
  url: string;
  status: number | "error";
  ms: number;
  bodyPreview: string;
  topLevelKeys?: string[];
};

async function probeOne(label: string, urlNoKey: string, apiKey: string): Promise<Probe> {
  const url = `${urlNoKey}${urlNoKey.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(apiKey)}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    const ms = Date.now() - t0;
    const text = await res.text().catch(() => "");
    let topLevelKeys: string[] | undefined;
    try {
      const j = JSON.parse(text);
      if (j && typeof j === "object" && !Array.isArray(j)) topLevelKeys = Object.keys(j);
    } catch {
      // not JSON
    }
    return {
      label,
      url: urlNoKey,
      status: res.status,
      ms,
      bodyPreview: text.slice(0, 400),
      topLevelKeys,
    };
  } catch (err) {
    return {
      label,
      url: urlNoKey,
      status: "error",
      ms: Date.now() - t0,
      bodyPreview: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function POST(req: NextRequest) {
  let body: { apiKey?: string; citation?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const apiKey = body.apiKey?.trim();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "Missing apiKey in body" }, { status: 400 });
  }

  // Defaults to Honda v Keays — a real, well-known SCC case.
  const citation = body.citation?.trim() || "2008 SCC 39";
  const m = citation.match(/(?:\[)?(\d{4})(?:\])?\s+([A-Z]{2,8})\s+(\d+)/);
  if (!m) {
    return NextResponse.json(
      { ok: false, error: `Citation "${citation}" couldn't be parsed into year+court+number` },
      { status: 400 }
    );
  }
  const [, year, courtUpper, num] = m;
  const courtLower = courtUpper.toLowerCase();
  const slug = `${year}${courtLower}${num}`;

  const base = "https://api.canlii.org/v1";

  // Try several shapes for the same query in parallel
  const probes = await Promise.all([
    // Confirm the key works at all
    probeOne("databases-list", `${base}/caseBrowse/en/`, apiKey),
    // Direct case-detail lookups using different DB ID forms
    probeOne(`case-detail (db=csc-scc)`, `${base}/caseBrowse/en/csc-scc/${slug}/`, apiKey),
    probeOne(`case-detail (db=${courtLower})`, `${base}/caseBrowse/en/${courtLower}/${slug}/`, apiKey),
    // Browse the database (paginated list, no text filter)
    probeOne(`db-browse (db=csc-scc)`, `${base}/caseBrowse/en/csc-scc/?resultCount=3`, apiKey),
    probeOne(`db-browse (db=${courtLower})`, `${base}/caseBrowse/en/${courtLower}/?resultCount=3`, apiKey),
    // The "text=" syntax we'd been using — confirm it's ignored / unsupported
    probeOne(
      `db-browse with text= (db=csc-scc)`,
      `${base}/caseBrowse/en/csc-scc/?text=Keays&resultCount=3`,
      apiKey
    ),
  ]);

  // Try to extract the actual SCC database ID from the databases-list result
  let sccDbIds: string[] = [];
  try {
    const list = probes[0];
    if (typeof list.status === "number" && list.status === 200) {
      const j = JSON.parse(list.bodyPreview);
      if (Array.isArray(j?.caseDatabases)) {
        sccDbIds = j.caseDatabases
          .filter((d: { name?: string }) => /supreme court of canada/i.test(d.name ?? ""))
          .map((d: { databaseId?: string }) => d.databaseId ?? "");
      }
    }
  } catch {
    // ignore
  }

  return NextResponse.json({
    ok: true,
    citation,
    parsed: { year, court: courtUpper, number: num, slug },
    sccDbIdsFromList: sccDbIds,
    probes,
  });
}
