import { NextRequest, NextResponse } from "next/server";
import { callOpenAICompat } from "@/lib/adapters/openai-compat";
import { callGemini } from "@/lib/adapters/gemini";
import { getCurrentSession } from "@/lib/auth/session";
import { checkCustomEndpoint, SERVER_PROVIDERS, serverProviderFor } from "@/lib/chat-guard";
import { allowRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatBody = {
  kind?: unknown;
  baseUrl?: unknown;
  modelId?: unknown;
  apiKey?: unknown;
  prompt?: unknown;
};

// Documents are cut to 60,000 characters before they go into a prompt (lib/prompts.ts),
// so this leaves plenty of room for the question and the answer being checked.
const MAX_PROMPT_CHARS = 300_000;
const MAX_KEY_CHARS = 500;
const MODEL_ID = /^[\w.:/@+~-]{1,200}$/;
// Requests allowed from one address, and per signed-in user on the server's own keys.
const PER_ADDRESS = { limit: 300, windowSeconds: 10 * 60 };
const PER_USER_ON_SERVER_KEYS = { limit: 300, windowSeconds: 24 * 60 * 60 };

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function clientAddress(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return fail("Invalid JSON body", 400);
  }
  if (!body || typeof body !== "object") return fail("Invalid JSON body", 400);

  if (!(await allowRequest(`chat:addr:${clientAddress(req)}`, PER_ADDRESS.limit, PER_ADDRESS.windowSeconds))) {
    return fail("Too many requests. Wait a few minutes and try again.", 429);
  }

  const { kind, baseUrl, modelId, prompt } = body;
  const ownKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

  if (kind !== "gemini" && kind !== "openai-compat") return fail("Unknown kind", 400);
  if (typeof modelId !== "string" || typeof prompt !== "string" || !modelId || !prompt) {
    return fail("modelId and prompt are required", 400);
  }
  if (!MODEL_ID.test(modelId)) return fail("modelId is not a valid model ID", 400);
  if (prompt.length > MAX_PROMPT_CHARS) {
    return fail(`The prompt is too long (over ${MAX_PROMPT_CHARS.toLocaleString()} characters).`, 413);
  }
  if (ownKey.length > MAX_KEY_CHARS) return fail("The API key is too long.", 400);

  // Work out where the request goes before touching any key. The server's own keys
  // only ever go to the providers' fixed addresses; any other address needs the
  // caller's own key.
  let target = "";
  let serverEnvKey = "";
  if (kind === "openai-compat") {
    if (typeof baseUrl !== "string" || !baseUrl.trim()) return fail("baseUrl is required", 400);
    const provider = serverProviderFor(baseUrl);
    if (provider) {
      target = SERVER_PROVIDERS[provider].baseUrl;
      if (!ownKey) serverEnvKey = SERVER_PROVIDERS[provider].envKey;
    } else if (ownKey) {
      const problem = await checkCustomEndpoint(baseUrl);
      if (problem) return fail(problem, 400);
      target = baseUrl.trim();
    } else {
      return fail("This site has no key for that address. Add your own key for it on the Settings page.", 400);
    }
  } else if (!ownKey) {
    serverEnvKey = "GEMINI_API_KEY";
  }

  let apiKey = ownKey;
  if (!apiKey) {
    // The site's own keys are for signed-in users only.
    const session = await getCurrentSession();
    if (!session) return fail("Sign in, or add your own API key on the Settings page.", 401);
    apiKey = process.env[serverEnvKey] ?? "";
    if (!apiKey) return fail("Missing API key. Add it on the Settings page.", 400);
    const allowed = await allowRequest(
      `chat:user:${session.email}`,
      PER_USER_ON_SERVER_KEYS.limit,
      PER_USER_ON_SERVER_KEYS.windowSeconds
    );
    if (!allowed) return fail("Today's limit for the site's own API keys is used up. Try again tomorrow.", 429);
  }

  try {
    const text =
      kind === "gemini"
        ? await callGemini({ apiKey, modelId, prompt })
        : await callOpenAICompat({ baseUrl: target, apiKey, modelId, prompt });
    return NextResponse.json({ text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return fail(message, 502);
  }
}
