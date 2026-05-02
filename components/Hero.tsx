export function Hero() {
  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 via-white to-emerald-50 p-5 shadow-sm dark:border-slate-800 dark:from-blue-950/40 dark:via-slate-900 dark:to-emerald-950/30 sm:mb-8 sm:p-7">
      <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-blue-200/40 blur-3xl dark:bg-blue-900/20" />
      <div className="absolute -bottom-16 -left-12 h-48 w-48 rounded-full bg-emerald-200/40 blur-3xl dark:bg-emerald-900/20" />
      <div className="relative max-w-3xl">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white/70 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-blue-700 dark:border-blue-900/50 dark:bg-slate-900/70 dark:text-blue-300">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          Independent verification
        </span>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
          Don&apos;t trust one AI with your legal research.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-700 dark:text-slate-300 sm:text-base">
          Paste an answer, attach the source document, and have a panel of independent
          models cross-check it for hallucinations, missed authorities, and weak
          reasoning — in one click.
        </p>
        <ul className="mt-4 grid gap-2 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-3">
          <li className="flex items-start gap-2">
            <Check />
            <span>Free models from Groq, OpenRouter, Gemini, Mistral</span>
          </li>
          <li className="flex items-start gap-2">
            <Check />
            <span>Color-coded verdicts: red → amber → green</span>
          </li>
          <li className="flex items-start gap-2">
            <Check />
            <span>Your keys stay in your browser — nothing stored</span>
          </li>
        </ul>
      </div>
    </section>
  );
}

function Check() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 0 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
