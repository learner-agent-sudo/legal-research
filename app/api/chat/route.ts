import { NextRequest, NextResponse } from "next/server";
import { callOpenAICompat } from "@/lib/adapters/openai-compat";
import { callGemini } from "@/lib/adapters/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatBody = {
  kind: "openai-compat" | "gemini";
  baseUrl?: string;
  modelId: string;
  apiKey?: string;
  prompt: string;
};

export async function POST(req: NextRequest) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { kind, baseUrl, modelId, prompt } = body;
  let apiKey = body.apiKey;

  if (!apiKey) {
    if (kind === "gemini") apiKey = process.env.GEMINI_API_KEY;
    else if (baseUrl?.includes("groq.com")) apiKey = process.env.GROQ_API_KEY;
    else if (baseUrl?.includes("openrouter.ai")) apiKey = process.env.OPENROUTER_API_KEY;
    else if (baseUrl?.includes("mistral.ai")) apiKey = process.env.MISTRAL_API_KEY;
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing API key. Add it on the Settings page." },
      { status: 400 }
    );
  }

  if (!modelId || !prompt) {
    return NextResponse.json({ error: "modelId and prompt are required" }, { status: 400 });
  }

  try {
    let text: string;
    if (kind === "gemini") {
      text = await callGemini({ apiKey, modelId, prompt });
    } else if (kind === "openai-compat") {
      if (!baseUrl) {
        return NextResponse.json({ error: "baseUrl is required" }, { status: 400 });
      }
      text = await callOpenAICompat({ baseUrl, apiKey, modelId, prompt });
    } else {
      return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
    }
    return NextResponse.json({ text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
