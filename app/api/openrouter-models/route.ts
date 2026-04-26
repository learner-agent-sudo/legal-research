import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 300; // cache 5 minutes

type OpenRouterModel = {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
};

export async function GET() {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `OpenRouter returned ${res.status}` },
        { status: 502 }
      );
    }
    const json = (await res.json()) as { data?: OpenRouterModel[] };
    const all = json.data ?? [];

    const free = all
      .filter((m) => {
        const p = parseFloat(m.pricing?.prompt ?? "0");
        const c = parseFloat(m.pricing?.completion ?? "0");
        return p === 0 && c === 0;
      })
      .map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        contextLength: m.context_length ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ models: free });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
