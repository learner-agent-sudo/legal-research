# Legal Research Cross-Verifier

A small webapp that takes an answer from one AI (e.g. Claude) and has several other free AI models verify it against a reference legal document. Each model returns a `[GREEN] / [YELLOW] / [RED]` verdict with reasoning, surfaced as a colour-coded scoreboard. You can then ask another model to synthesise the concerns into one report, and run citation checks against CanLII.

Built for Canadian legal research workflows — Ontario statutes and Canadian case law are first-class. UK/HK/US support is on the roadmap.

## Quick start

1. Visit the deployed app (or run `npm run dev` locally).
2. Open **Settings**, paste at least one API key (Groq is the fastest free option — get one at <https://console.groq.com/keys>).
3. On the home page:
   - Paste the AI answer you want verified
   - Optionally paste your question and upload the legal document the answer was based on (`.docx` or `.txt`)
   - Tick the verifier models you want
   - Click **Run verification**

You'll see each model's verdict, full critique, and an AI-synthesis option that consolidates the flagged concerns.

## What it supports

### AI verifiers (free APIs)

| Provider | Sign-up | Models |
|---|---|---|
| Groq | <https://console.groq.com/keys> | Llama 3.3 70B, DeepSeek-R1, Qwen 2.5 |
| OpenRouter | <https://openrouter.ai/keys> | DeepSeek V3, Qwen 3, dozens of `:free` models |
| Google Gemini | <https://aistudio.google.com/apikey> | Gemini 2.5 Flash, 2.5 Pro |
| Mistral | <https://console.mistral.ai/api-keys/> | Mistral Small |

You can also add any OpenAI-compatible provider manually in Settings (DeepSeek direct, Together AI, local LM Studio, etc.).

**Manual paste only**: ChatGPT and Perplexity — no API, opens the chat UI with the prompt copied to your clipboard.

### Citation verification (CanLII)

The **Citation Test** page extracts citations from a block of text and verifies them against CanLII:

- **Case citations** (e.g. `Honda Canada Inc. v. Keays, 2008 SCC 39`):
  - Direct case-detail lookup via the CanLII API
  - 🟢 Confirms the case exists with title, decision date, docket number, canonical URL
  - 🔴 Flags as "possibly hallucinated" if not found
  - Falls back to a deterministic canlii.org URL when the API key is missing

- **Statute citations** (e.g. `Employment Standards Act, 2000, section 14(2)`):
  - Opens canlii.org's web search filtered by jurisdiction
  - Optionally fetches live section text from `ontario.ca/laws` (Ontario only)
  - Optionally runs an AI verifier against the live text to check Claude's claim

CanLII API key is free for non-commercial use — request one at <https://www.canlii.org/en/info/api.html>.

### Verification history

When signed in (email-MFA login), every Verify run is auto-saved. Visit **/history** to:

- Browse past runs across devices
- See the question, AI answer, attached document, every response, and AI consolidations
- **Restore** a past run back to the editor with one click
- **Delete** individual entries or clear all

Caps: 50 sessions/account (oldest evicted), sessions over 500 KB skipped, documents truncated to 30 KB. Session contents only accessible to the signed-in user.

## Limitations and known gaps

- **Live legislation text** is currently Ontario-only. The fetch hits `ontario.ca/laws` and parses the static HTML. Sites that render content with JavaScript (most modern provincial e-Laws portals) cannot be scraped server-side.
- **CanLII has no text-search API.** Case verification is by direct ID lookup only — works when the citation parses cleanly into year + court + number. Legislation lookup opens the canlii.org web search; there's no way to fetch a specific act by name via the API.
- **Citation extractor is Canadian-focused.** Recognises neutral citations like `2008 SCC 39` and `[2019] ONCA 123`. Doesn't yet recognise UK/HK/US formats.
- **Consolidation prompts skip the document.** The AI synthesis step deliberately drops the document text from its prompt to stay under model context limits (especially Groq's ~12K TPM cap). It synthesises the existing critiques, doesn't re-verify.

## How API keys are stored

Keys live in your browser's `localStorage`. They're sent to the Next.js API route only at request time and forwarded straight to the provider — never written to a database. On a new machine, paste your keys once in Settings.

If you prefer keys server-side, set `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `CANLII_API_KEY` in Vercel's env vars. The API routes fall back to those when no key is sent from the browser.

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>, paste a key in Settings, go.

Useful commands:

```bash
npm run lint              # eslint
npx tsc --noEmit          # type check
npx vitest run            # unit tests (citation extractor, prompts, etc.)
```

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import it at <https://vercel.com/new>.
3. Click Deploy. No env vars needed — the app works with browser-stored keys.

For login + history, also configure:

- `SESSION_SECRET` (32+ char random string, `openssl rand -hex 32`)
- `ALLOWED_EMAILS` (comma-separated allow-list)
- `RESEND_API_KEY` + `EMAIL_FROM` (for login emails)
- `KV_REST_API_URL` + `KV_REST_API_TOKEN` (Upstash Redis for history)

Without Upstash, history is silently disabled and everything else still works.

## Project structure

```
app/
  page.tsx                    # main verifier UI
  history/page.tsx            # verification history browser
  citation-test/page.tsx      # citation extraction + CanLII verification
  settings/page.tsx           # API key + custom-model management
  api/
    chat/route.ts                  # forwards prompts to the chosen provider
    parse-docx/route.ts            # extracts text from uploaded .docx files
    canlii/lookup/route.ts         # CanLII case-detail and (legacy) search
    canlii/test/route.ts           # connectivity check (used in Settings)
    canlii/probe/route.ts          # deeper diagnostic — probes multiple endpoint shapes
    lookup-legislation/route.ts    # fetches Ontario statute section text
    user/history/route.ts          # GET list, POST save, DELETE clear-all
    user/history/[id]/route.ts     # GET one session, DELETE one session
lib/
  presets.ts                  # built-in model list
  prompts.ts                  # verification + consolidation prompts
  storage.ts                  # localStorage helpers
  history.ts                  # client helpers: saveSession, listSessions, etc.
  citations/
    extract.ts                # statute + case citation extractor
    canlii.ts                 # CanLII API client (case-detail, legacy search)
    canlii-courts.ts          # court → database ID + jurisdiction map, doc URL builder
  adapters/
    openai-compat.ts          # Groq, OpenRouter, DeepSeek, Qwen, custom
    gemini.ts                 # Google Gemini
components/
  ConsolidatePanel.tsx        # AI synthesis of flagged concerns
  VerdictScoreboard.tsx       # per-model verdict summary
  AdjudicationPanel.tsx       # ask another model to break a tie
  ProviderPings.tsx           # connectivity tests for each API
```

## Roadmap

See `ROADMAP.md` for planned work. Headline items:

- UK legislation support via the `legislation.gov.uk` API
- Better citation extractor (recognise UK/HK formats; tolerate parallel citations)
- Per-section live text fetch for federal Canadian statutes
- Optional case-text comparison (canlii.org HTML scrape + AI compare against the AI's claims)
