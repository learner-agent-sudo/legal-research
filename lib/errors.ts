export type FriendlyError = {
  title: string;
  hint: string;
  raw: string;
};

export function humanizeError(raw: string, providerLabel: string): FriendlyError {
  const lower = raw.toLowerCase();

  // 401 — bad or missing key
  if (raw.includes("401") || lower.includes("unauthorized") || lower.includes("invalid api key") || lower.includes("invalid_api_key")) {
    return {
      title: "API key not accepted",
      hint: `${providerLabel} rejected the key. Open Settings, paste a fresh key, and Save.`,
      raw,
    };
  }

  // 402 — payment required / no balance
  if (raw.includes("402") || lower.includes("insufficient balance") || lower.includes("payment required") || lower.includes("quota") || lower.includes("billing")) {
    return {
      title: "No credit / quota left",
      hint: "This provider needs a paid balance, or your free quota is used up. Try a different model, or wait for the daily quota to reset (usually midnight UTC).",
      raw,
    };
  }

  // 404 — model not found / retired
  if (raw.includes("404") || lower.includes("no endpoints found") || lower.includes("model not found") || lower.includes("does not exist")) {
    return {
      title: "This model is no longer available",
      hint: "The provider has retired this model ID or temporarily disabled it. Pick another model, or update the ID in Settings (custom models).",
      raw,
    };
  }

  // 400 — bad model id / bad request
  if (raw.includes("is not a valid model") || lower.includes("model_not_found") || lower.includes("invalid model")) {
    return {
      title: "Model ID not recognized",
      hint: "The provider doesn't know this model ID. Either pick a different built-in model, or fix the ID in Settings → custom models.",
      raw,
    };
  }
  if (raw.includes("400")) {
    return {
      title: "Provider rejected the request",
      hint: "The request was malformed for this provider. If you added this model manually, double-check the base URL and model ID in Settings.",
      raw,
    };
  }

  // 429 — rate limit
  if (raw.includes("429") || lower.includes("rate limit") || lower.includes("too many requests")) {
    return {
      title: "Rate limit hit",
      hint: "You've hit this provider's per-minute or per-day free limit. Wait a minute and try again, or try tomorrow if it's a daily cap.",
      raw,
    };
  }

  // 413 / context length
  if (lower.includes("context length") || lower.includes("too long") || lower.includes("maximum context") || lower.includes("token limit")) {
    return {
      title: "Input too long",
      hint: "Your document or pasted answer is longer than this model can handle. Try a model with a bigger context window (Gemini 2.5 Pro), or shorten the document.",
      raw,
    };
  }

  // 5xx — provider down
  if (/\b5\d\d\b/.test(raw) || lower.includes("internal server error") || lower.includes("service unavailable") || lower.includes("bad gateway")) {
    return {
      title: "Provider is having issues",
      hint: "This isn't your fault — the provider's servers returned an error. Try again in a minute, or use a different model.",
      raw,
    };
  }

  // Network / fetch failures
  if (lower.includes("fetch failed") || lower.includes("network") || lower.includes("econnrefused") || lower.includes("etimedout")) {
    return {
      title: "Couldn't reach the provider",
      hint: "Network problem talking to the provider. Check your internet, then try again.",
      raw,
    };
  }

  // Empty response
  if (lower.includes("empty response")) {
    return {
      title: "Empty response from provider",
      hint: "The provider returned nothing. Try a different model — this sometimes happens when content is filtered.",
      raw,
    };
  }

  return {
    title: "Something went wrong",
    hint: "See the details below. If you can't tell what went wrong, copy the message and paste it into the chat.",
    raw,
  };
}
