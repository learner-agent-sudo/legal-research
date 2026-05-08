export type ProviderKind = "openai-compat" | "gemini" | "deep-link";

export type ModelPreset = {
  id: string;
  label: string;
  provider: string;
  kind: ProviderKind;
  baseUrl?: string;
  modelId?: string;
  deepLinkUrl?: string;
  note?: string;
  contextLength?: number;
};

export const BUILTIN_PRESETS: ModelPreset[] = [
  {
    id: "groq-llama-3.3-70b",
    label: "Llama 3.3 70B (Groq, free)",
    provider: "groq",
    kind: "openai-compat",
    baseUrl: "https://api.groq.com/openai/v1",
    modelId: "llama-3.3-70b-versatile",
  },
  {
    id: "groq-llama-3.1-8b",
    label: "Llama 3.1 8B Instant (Groq, free)",
    provider: "groq",
    kind: "openai-compat",
    baseUrl: "https://api.groq.com/openai/v1",
    modelId: "llama-3.1-8b-instant",
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash (Google, free tier)",
    provider: "gemini",
    kind: "gemini",
    modelId: "gemini-2.5-flash",
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro (Google, free tier)",
    provider: "gemini",
    kind: "gemini",
    modelId: "gemini-2.5-pro",
  },
  {
    id: "mistral-small",
    label: "Mistral Small (Mistral, free tier)",
    provider: "mistral",
    kind: "openai-compat",
    baseUrl: "https://api.mistral.ai/v1",
    modelId: "mistral-small-latest",
  },
  {
    id: "mistral-large",
    label: "Mistral Large (Mistral, paid)",
    provider: "mistral",
    kind: "openai-compat",
    baseUrl: "https://api.mistral.ai/v1",
    modelId: "mistral-large-latest",
    note: "Mistral's flagship model — paid tier, higher rate limits.",
  },
  {
    id: "chatgpt-web",
    label: "ChatGPT (web, manual paste)",
    provider: "chatgpt",
    kind: "deep-link",
    deepLinkUrl: "https://chat.openai.com/",
    note: "No free API — opens ChatGPT in a new tab with the prompt on your clipboard.",
  },
  {
    id: "perplexity-web",
    label: "Perplexity (web, manual paste)",
    provider: "perplexity",
    kind: "deep-link",
    deepLinkUrl: "https://www.perplexity.ai/",
    note: "No free API — opens Perplexity in a new tab with the prompt on your clipboard.",
  },
];

export const PROVIDER_KEY_NAMES: Record<string, string> = {
  groq: "Groq API key",
  openrouter: "OpenRouter API key",
  gemini: "Google Gemini API key",
  mistral: "Mistral API key",
  canlii: "CanLII API key (Canadian case law & legislation)",
};

export const PROVIDER_SIGNUP_URLS: Record<string, string> = {
  groq: "https://console.groq.com/keys",
  openrouter: "https://openrouter.ai/keys",
  gemini: "https://aistudio.google.com/apikey",
  mistral: "https://console.mistral.ai/api-keys/",
  canlii: "https://www.canlii.org/en/info/api.html",
};
