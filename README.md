# Legal Research Cross-Verifier

A small webpage that lets you take an answer from one AI (e.g. Claude) and have several other free AI models verify it against a reference legal document. You paste the answer, upload a `.docx` or `.txt` file, tick the models you want, and see all responses side-by-side.

## What it supports

**Free via API (recommended)**
- **Groq** — Llama 3.3 70B, DeepSeek-R1-distill, Qwen 2.5
- **OpenRouter** — DeepSeek V3, Qwen 3, and many other `:free` models
- **Google Gemini** — Gemini 2.5 Flash, 2.5 Pro (free tier)
- **Mistral** — Mistral Small (free tier)

**Add any other OpenAI-compatible provider manually** via the Settings page (e.g. DeepSeek direct, Together AI, local LM Studio).

**Manual paste only (no free API)**
- ChatGPT — opens chat.openai.com with the prompt copied to your clipboard
- Perplexity — same flow

## How API keys are stored

Keys live in your browser's `localStorage`. They are sent to the Next.js API route only at request time and forwarded straight to the provider — they are never written to a database. On a new machine, just visit the Settings page and paste your keys once.

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Go to **Settings**, paste at least one API key (Groq is fastest to set up — free key from <https://console.groq.com/keys>), then go back to the home page.

## Deploying to Vercel (recommended)

1. Push this repo to GitHub.
2. Go to <https://vercel.com/new>, import the repo.
3. Click Deploy. No env vars needed — the app works with browser-stored keys.
4. Open the resulting URL on any machine, go to Settings, paste your keys.

If you prefer keys server-side instead, set `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY` in Vercel's environment variables. The API route falls back to those if no key is sent from the browser.

## Where to get free API keys

| Provider | Sign-up |
|---|---|
| Groq | <https://console.groq.com/keys> |
| OpenRouter | <https://openrouter.ai/keys> |
| Google Gemini | <https://aistudio.google.com/apikey> |
| Mistral | <https://console.mistral.ai/api-keys/> |

## Project structure

```
app/
  page.tsx              # main verifier UI
  settings/page.tsx     # API key + custom-model management
  api/chat/route.ts     # forwards prompts to the chosen provider
  api/parse-docx/route.ts # extracts text from uploaded .docx files
lib/
  presets.ts            # built-in model list
  prompts.ts            # verification prompt template
  storage.ts            # localStorage helpers
  adapters/
    openai-compat.ts    # Groq, OpenRouter, DeepSeek, Qwen, custom
    gemini.ts           # Google Gemini
```
