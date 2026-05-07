"use client";

type Verdict = "green" | "yellow" | "red" | "none";

export type ScoreboardEntry = {
  id: string;
  label: string;
  verdict: Verdict;
};

const CONFIG = {
  red: {
    heading: "Major issues",
    dot: "bg-rose-500",
    countCls: "text-rose-700 dark:text-rose-400",
    pill: "bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-900",
    border: "border-rose-200 dark:border-rose-900",
    bg: "bg-rose-50 dark:bg-rose-950/20",
    emoji: "✗",
  },
  yellow: {
    heading: "Some concerns",
    dot: "bg-amber-500",
    countCls: "text-amber-700 dark:text-amber-400",
    pill: "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-900",
    border: "border-amber-200 dark:border-amber-900",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    emoji: "!",
  },
  green: {
    heading: "Looks correct",
    dot: "bg-emerald-500",
    countCls: "text-emerald-700 dark:text-emerald-400",
    pill: "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900",
    border: "border-emerald-200 dark:border-emerald-900",
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    emoji: "✓",
  },
} as const;

/** Sanitise a model id to a safe HTML anchor id */
export function cardAnchorId(modelId: string) {
  return "result-" + modelId.replace(/[^a-zA-Z0-9-_]/g, "-");
}

export function VerdictScoreboard({ entries }: { entries: ScoreboardEntry[] }) {
  const byVerdict = {
    red:    entries.filter((e) => e.verdict === "red"),
    yellow: entries.filter((e) => e.verdict === "yellow"),
    green:  entries.filter((e) => e.verdict === "green"),
  };

  const anyFindings = byVerdict.red.length + byVerdict.yellow.length + byVerdict.green.length > 0;
  if (!anyFindings) return null;

  const verdictOrder = ["red", "yellow", "green"] as const;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
        Verdict summary
      </h3>

      {/* Mobile: stacked; sm+: 3 columns side by side */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {verdictOrder.map((v) => {
          const group = byVerdict[v];
          const cfg = CONFIG[v];
          return (
            <div
              key={v}
              className={`rounded-lg border p-2.5 ${cfg.border} ${cfg.bg}`}
            >
              {/* Column header */}
              <div className="mb-2 flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cfg.dot}`} />
                <span className={`text-xs font-semibold ${cfg.countCls}`}>
                  {cfg.emoji} {cfg.heading}
                </span>
                <span className={`ml-auto text-xs font-bold ${cfg.countCls}`}>
                  {group.length}
                </span>
              </div>

              {/* Model pills */}
              {group.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500">—</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {group.map((e) => (
                    <li key={e.id}>
                      <a
                        href={`#${cardAnchorId(e.id)}`}
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cfg.pill} hover:opacity-80 transition-opacity`}
                      >
                        {e.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: compact single-line version is handled by the grid above */}
    </div>
  );
}
