import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "../app/api/chat/route";

const env = process.env as Record<string, string | undefined>;
const realFetch = globalThis.fetch;
let calls: { url: string; init?: RequestInit }[] = [];
let address = 0;

beforeEach(() => {
  calls = [];
  env.NODE_ENV = "production";
  env.OPENROUTER_API_KEY = "server-openrouter-key";
  env.GROQ_API_KEY = "server-groq-key";
  env.GEMINI_API_KEY = "server-gemini-key";
  for (const name of ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) {
    delete env[name];
  }
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return Response.json({
      choices: [{ message: { content: "provider answer" } }],
      candidates: [{ content: { parts: [{ text: "provider answer" }] } }],
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

// Each test gets its own client address unless it passes one, so rate limits don't leak between tests.
function post(body: unknown, from = `203.0.113.${++address % 250}`) {
  return POST(
    new NextRequest("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": from },
      body: JSON.stringify(body),
    })
  );
}

const ask = { modelId: "some/model:free", prompt: "Is this right?" };

test("the site's keys are never sent to an address the caller chose", async () => {
  for (const baseUrl of [
    "https://evil.example/openrouter.ai",
    "https://openrouter.ai.evil.example/api/v1",
    "https://evil.example/?groq.com",
    "https://api.mistral.ai.evil.example/v1",
  ]) {
    const res = await post({ kind: "openai-compat", baseUrl, ...ask });
    assert.equal(res.status, 400, baseUrl);
  }
  assert.equal(calls.length, 0);
});

test("visitors who aren't signed in can't use the site's keys", async () => {
  const openrouter = await post({ kind: "openai-compat", baseUrl: "https://openrouter.ai/api/v1", ...ask });
  assert.equal(openrouter.status, 401);
  const gemini = await post({ kind: "gemini", ...ask, modelId: "gemini-2.5-flash" });
  assert.equal(gemini.status, 401);
  assert.equal(calls.length, 0);
});

test("a visitor's own key goes only to the provider's fixed address", async () => {
  const res = await post({
    kind: "openai-compat",
    baseUrl: "https://api.groq.com/openai/v1/",
    apiKey: "visitor-key",
    ...ask,
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { text: "provider answer" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.groq.com/openai/v1/chat/completions");
  assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer visitor-key");
  assert.equal(calls[0].init?.redirect, "error");
});

test("a visitor's own key with a Gemini model works without signing in", async () => {
  const res = await post({ kind: "gemini", apiKey: "visitor-key", ...ask, modelId: "gemini-2.5-flash" });
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash:generateContent/);
});

test("custom addresses on private networks, or without https, are refused", async () => {
  for (const baseUrl of [
    "http://api.example.com/v1",
    "https://169.254.169.254/latest",
    "https://10.0.0.5/v1",
    "https://127.0.0.1:1234/v1",
    "https://2130706433/v1",
    "https://localhost:1234/v1",
    "https://[::1]/v1",
    "https://[::ffff:127.0.0.1]/v1",
    "https://metadata.google.internal/v1",
    "https://user:pass@api.example.com/v1",
    "file:///etc/passwd",
    "not a url",
  ]) {
    const res = await post({ kind: "openai-compat", baseUrl, apiKey: "visitor-key", ...ask });
    assert.equal(res.status, 400, baseUrl);
  }
  assert.equal(calls.length, 0);
});

test("oversized prompts, odd model IDs and unknown kinds are refused", async () => {
  const base = { kind: "openai-compat", baseUrl: "https://openrouter.ai/api/v1", apiKey: "visitor-key" };
  assert.equal((await post({ ...base, ...ask, prompt: "x".repeat(300_001) })).status, 413);
  assert.equal((await post({ ...base, ...ask, modelId: "model id with spaces" })).status, 400);
  assert.equal((await post({ ...base, ...ask, modelId: "x".repeat(201) })).status, 400);
  assert.equal((await post({ ...base, ...ask, kind: "other" })).status, 400);
  assert.equal((await post({ ...base, prompt: "x" })).status, 400);
  assert.equal(calls.length, 0);
});

test("one address can't send unlimited requests", async () => {
  const body = { kind: "openai-compat", baseUrl: "https://openrouter.ai/api/v1", apiKey: "visitor-key", ...ask };
  for (let i = 0; i < 300; i++) {
    assert.equal((await post(body, "198.51.100.7")).status, 200);
  }
  assert.equal((await post(body, "198.51.100.7")).status, 429);
  assert.equal((await post(body, "198.51.100.8")).status, 200);
});
