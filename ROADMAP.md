# Roadmap

Backlog of features we explicitly chose not to build now. Each one has the use case spelled out so we know what success looks like when we pick it up.

---

## 1. Public demo mode (zero-setup for testers)

**Use case**: You share the URL with a tester or colleague who has no API key and no patience to sign up for one. They open the URL, click Verify, it works.

**How it would work**:
- Set `GROQ_API_KEY`, `GEMINI_API_KEY`, etc. as Vercel env vars
- The existing `/api/chat` route already falls back to env-var keys when the browser doesn't send one — so this mostly works today
- What's missing: a UI hint on the home page that says *"Demo mode: using shared keys, no setup needed"* and silences the *"No API key for groq"* error path
- Optional: a separate "demo" subdomain or path that only allows the demo keys (so signed-in users still use their own quota)

**Trade-offs**:
- Anyone with the URL uses your free-tier quota — fine for low-traffic demos, painful if it goes viral
- Free-tier providers may rate-limit per IP so concurrent testers can break each other
- For OpenRouter free models with the privacy toggle on, all tester prompts could be used for training under your account — bad for client-confidential work

**Priority**: medium. Easy to ship, high "wow" factor for sharing.

---

## 2. Lightweight password gate (instead of email MFA)

**Use case**: A small group of trusted testers wants shared access. Email-MFA per tester is friction. A single shared password is simpler.

**How it would work**:
- New env var `SHARED_PASSWORD`
- Middleware: any visit without a session cookie redirects to `/unlock`
- `/unlock` accepts the password, sets a long-lived cookie, lets them through
- Coexists with the email-MFA flow (the password lets you in; signing in with email lets you in AND syncs keys to your account)

**Trade-offs**:
- One leaked password = open access. Rotation is manual.
- Less accountability than per-email login

**Priority**: medium-low. Useful for small private demos.

---

## 3. Streaming responses

**Use case**: Long answers from slow free-tier providers feel like the page is frozen for 20+ seconds. Streaming would show the answer appearing word-by-word.

**How it would work**:
- `/api/chat` returns a `ReadableStream` instead of waiting for the full response
- Client uses `Response.body.getReader()` to render incrementally
- Verdict tag parsing happens after the first line lands

**Trade-offs**:
- More complex error handling — partial responses are possible
- Markdown re-renders on every token, perf-sensitive

**Priority**: medium. Significantly better UX for long answers.

---

## 4. Real URL fetching for citations

**Use case**: Today, when a model checks a cited URL, it's making it up from training data. We tell it not to invent things, but it still can't actually verify.

**How it would work**:
- Detect URLs in Claude's pasted answer
- Add a "Verify links" toggle that pre-fetches each URL server-side
- Inject the fetched content into the model's context

**Trade-offs**:
- Many sites block scrapers
- Adds latency
- Inappropriate for paywalled databases (Westlaw, LexisNexis)

**Priority**: low. Perplexity already does this and we have the deep-link.

---

## 5. Multi-user demo mode (per-tester accounts)

**Use case**: You want to give 5 testers individual, isolated accounts so their experiments don't tangle.

**How it would work**:
- Email whitelist supports multiple emails (already does — comma-separated `ALLOWED_EMAILS`)
- Per-user storage already keyed by email
- What's missing: a tester-friendly onboarding flow, and possibly a quota-per-email cap so one tester can't drain a shared free-tier provider key

**Priority**: low-medium. Wait until we have actual testers.

---

## 6. Conflict resolution for simultaneous edits

**Use case**: You edit a prompt on your laptop and your phone at the same time. Right now: last save wins, silently.

**How it would work**:
- Stamp every save with a version number (already stamping `updatedAt`)
- On save, compare the server's version with what we read at load
- If diverged, show a diff and let the user pick

**Priority**: low. Single-user setup makes this rare.

---

## 7. Citation diffing

**Use case**: When a model flags an error, it would be great to see the exact phrase highlighted in Claude's original answer above, not just bolded inside the AI's reply.

**Priority**: low.

---

## 8. Direct provider model fetch (Groq, Mistral)

**Use case**: Like the OpenRouter dynamic loader, but for Groq and Mistral too. Today these are hardcoded and break when models get retired.

**How it would work**: same pattern as `/api/openrouter-models`, but per-provider. Need the user's API key for each since these endpoints require auth.

**Priority**: low. Groq retirements are infrequent.
