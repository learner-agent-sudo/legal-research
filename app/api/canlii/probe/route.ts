import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

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
    } catch { /* not JSON */ }
    return { label, url: urlNoKey, status: res.status, ms, bodyPreview: text.slice(0, 500), topLevelKeys };
  } catch (err) {
    return { label, url: urlNoKey, status: "error", ms: Date.now() - t0, bodyPreview: err instanceof Error ? err.message : String(err) };
  }
}

export async function POST(req: NextRequest) {
  let body: { apiKey?: string; citation?: string; legislationQuery?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 }); }

  const apiKey = body.apiKey?.trim();
  if (!apiKey) return NextResponse.json({ ok: false, error: "Missing apiKey" }, { status: 400 });

  const base = "https://api.canlii.org/v1";
  const legQuery = body.legislationQuery ?? "Labour Relations Act";
  const legQ = encodeURIComponent(legQuery);

  const probes = await Promise.all([
    // ── Legislation probes ─────────────────────────────────────────────────
    // Does ?text= work on the legislation browse root?
    probeOne("leg: root ?text=", `${base}/legislationBrowse/en/?text=${legQ}`, apiKey),
    // Does ?text= + jurisdiction work?
    probeOne("leg: root ?text= +jurisdiction=on", `${base}/legislationBrowse/en/?text=${legQ}&jurisdiction=on`, apiKey),
    // List all legislation databases (no filter)
    probeOne("leg: databases list", `${base}/legislationBrowse/en/`, apiKey),
    // Does an Ontario legislation database exist?
    probeOne("leg: db=onlra (LRA)", `${base}/legislationBrowse/en/onlra/`, apiKey),
    probeOne("leg: db=onlra offset=0", `${base}/legislationBrowse/en/onlra/?offset=0&resultCount=5`, apiKey),
    // Try a known Ontario db slug
    probeOne("leg: db=on ?text=", `${base}/legislationBrowse/en/on/?text=${legQ}`, apiKey),
  ]);

  // Extract first few legislation database IDs from the databases list
  let legDbs: { databaseId: string; jurisdiction: string; name: string }[] = [];
  try {
    const listProbe = probes.find(p => p.label === "leg: databases list");
    if (listProbe && listProbe.status === 200) {
      const j = JSON.parse(listProbe.bodyPreview);
      const arr = j?.legislationDatabases ?? j?.databases ?? [];
      if (Array.isArray(arr)) {
        legDbs = arr
          .filter((d: { jurisdiction?: string }) => d.jurisdiction === "on" || d.jurisdiction === "ca")
          .slice(0, 10)
          .map((d: { databaseId?: string; jurisdiction?: string; name?: string }) => ({
            databaseId: d.databaseId ?? "",
            jurisdiction: d.jurisdiction ?? "",
            name: d.name ?? "",
          }));
      }
    }
  } catch { /* ignore */ }

  return NextResponse.json({ ok: true, legislationQuery: legQuery, legDbs, probes });
}
