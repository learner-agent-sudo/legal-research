import { NextRequest, NextResponse } from "next/server";
import { findOntarioAct } from "@/lib/citations/ontario-acts";
import { fetchOntarioSection } from "@/lib/citations/ontario-parser";
import { buildCitationVerifyPrompt, parseVerdict, type CitationVerdict } from "@/lib/citations/verify-prompt";
import { callOpenAICompat } from "@/lib/adapters/openai-compat";
import { callGemini } from "@/lib/adapters/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type VerifyCitationRequest = {
  jurisdiction: "ontario";      // "hk" coming in a later piece
  act: string;
  section: string;
  actCode?: string;             // optional override
  claudeClaim: string;          // the sentence(s) Claude wrote about this citation

  // If provided, skips live-fetching and uses this text as the section content
  // (for sources that can't be scraped server-side, e.g. JavaScript SPAs)
  manualSectionText?: string;

  // Which model to use for the AI verification step
  model: {
    kind: "openai-compat" | "gemini";
    baseUrl?: string;
    modelId: string;
    apiKey?: string;
  };
};

export type VerifyCitationResponse =
  | {
      ok: true;
      verdict: CitationVerdict | "not-found";
      explanation: string;
      sectionText: string | null;
      url: string | null;
      actCode: string | null;
    }
  | { ok: false; error: string };

export async function POST(req: NextRequest): Promise<NextResponse<VerifyCitationResponse>> {
  let body: VerifyCitationRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { jurisdiction, act, section, claudeClaim, model } = body;

  if (!jurisdiction || !act || !section || !claudeClaim) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields: jurisdiction, act, section, claudeClaim" },
      { status: 400 }
    );
  }
  if (!model?.kind || !model?.modelId) {
    return NextResponse.json(
      { ok: false, error: "Missing model configuration" },
      { status: 400 }
    );
  }

  // ── Step 1: resolve act code (only needed if we'll fetch) ───────────────
  const actCode = body.actCode ?? findOntarioAct(act)?.code ?? null;

  // ── Step 2: resolve section text — manual paste OR live fetch ───────────
  let sectionText: string;
  let sourceUrl: string;

  if (body.manualSectionText && body.manualSectionText.trim().length > 20) {
    sectionText = body.manualSectionText.trim();
    sourceUrl = actCode
      ? `https://www.ontario.ca/laws/statute/${actCode}`
      : "user-provided text";
  } else {
    if (!actCode) {
      return NextResponse.json({
        ok: true,
        verdict: "not-found",
        explanation: `Could not find "${act}" in the Ontario acts index. Provide actCode directly, or paste the section text manually.`,
        sectionText: null,
        url: null,
        actCode: null,
      });
    }
    const lookup = await fetchOntarioSection(actCode, section);
    if (!lookup.found) {
      return NextResponse.json({
        ok: true,
        verdict: "not-found",
        explanation: lookup.reason,
        sectionText: null,
        url: lookup.url,
        actCode,
      });
    }
    sectionText = lookup.text;
    sourceUrl = lookup.url;
  }

  // ── Step 3: resolve API key ──────────────────────────────────────────────
  let apiKey = model.apiKey;
  if (!apiKey) {
    if (model.kind === "gemini") apiKey = process.env.GEMINI_API_KEY;
    else if (model.baseUrl?.includes("groq.com")) apiKey = process.env.GROQ_API_KEY;
    else if (model.baseUrl?.includes("openrouter.ai")) apiKey = process.env.OPENROUTER_API_KEY;
    else if (model.baseUrl?.includes("mistral.ai")) apiKey = process.env.MISTRAL_API_KEY;
  }
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "No API key provided for the selected model." },
      { status: 400 }
    );
  }

  // ── Step 4: build prompt and call AI ────────────────────────────────────
  const prompt = buildCitationVerifyPrompt({
    jurisdiction: `Ontario, Canada`,
    act,
    section,
    sectionText,
    sourceUrl,
    claudeClaim,
  });

  let aiResponse: string;
  try {
    if (model.kind === "gemini") {
      aiResponse = await callGemini({ apiKey, modelId: model.modelId, prompt });
    } else {
      if (!model.baseUrl) {
        return NextResponse.json({ ok: false, error: "baseUrl required for openai-compat" }, { status: 400 });
      }
      aiResponse = await callOpenAICompat({
        baseUrl: model.baseUrl,
        apiKey,
        modelId: model.modelId,
        prompt,
      });
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `AI call failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }

  const verdict = parseVerdict(aiResponse);
  // Strip the leading [TAG] line from the explanation
  const explanation = aiResponse.replace(/^\[.*?\]\s*/i, "").trim();

  return NextResponse.json({
    ok: true,
    verdict,
    explanation,
    sectionText,
    url: sourceUrl,
    actCode,
  });
}
