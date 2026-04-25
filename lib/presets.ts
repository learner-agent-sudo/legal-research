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
    id: "groq-deepseek-r1-distill",
    label: "DeepSeek R1 Distill (Groq, free)",
    provider: "groq",
    kind: "openai-compat",
    baseUrl: "https://api.groq.com/openai/v1",
    modelId: "deepseek-r1-distill-llama-70b",
  },
  {
    id: "groq-qwen-2.5-32b",
    label: "Qwen 2.5 32B (Groq, free)",
    provider: "groq",
    kind: "openai-compat",
    baseUrl: "https://api.groq.com/openai/v1",
    modelId: "qwen-2.5-32b",
  },
  {
    id: "openrouter-deepseek-v3",
    label: "DeepSeek V3 (OpenRouter, free)",
    provider: "openrouter",
    kind: "openai-compat",
    baseUrl: "https://openrouter.ai/api/v1",
    modelId: "deepseek/deepseek-chat-v3-0324:free",
  },
  {
    id: "openrouter-deepseek-r1",
    label: "DeepSeek R1 (OpenRouter, free)",
    provider: "openrouter",
    kind: "openai-compat",
    baseUrl: "https://openrouter.ai/api/v1",
    modelId: "deepseek/deepseek-r1:free",
  },
  {
    id: "openrouter-qwen-2.5-72b",
    label: "Qwen 2.5 72B (OpenRouter, free)",
    provider: "openrouter",
    kind: "openai-compat",
    baseUrl: "https://openrouter.ai/api/v1",
    modelId: "qwen/qwen-2.5-72b-instruct:free",
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
};

export const PROVIDER_SIGNUP_URLS: Record<string, string> = {
  groq: "https://console.groq.com/keys",
  openrouter: "https://openrouter.ai/keys",
  gemini: "https://aistudio.google.com/apikey",
  mistral: "https://console.mistral.ai/api-keys/",
};
