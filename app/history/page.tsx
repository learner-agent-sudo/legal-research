"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  clearHistory,
  deleteSession,
  formatAbsoluteDate,
  formatRelativeTime,
  listSessions,
  loadSession,
  type Session,
  type SessionSummary,
} from "@/lib/history";
import {
  loadApiKeys,
  loadCustomModels,
  saveDraft,
  saveModelRoles,
  saveSelectedModels,
  type RoleMap,
} from "@/lib/storage";
import { BUILTIN_PRESETS, type ModelPreset } from "@/lib/presets";
import { useToast } from "@/components/Toast";
import { VerdictScoreboard, cardAnchorId, extractExcerpt, type ScoreboardEntry } from "@/components/VerdictScoreboard";
import { ConsolidatePanel } from "@/components/ConsolidatePanel";
import type { ConsolidationCritique } from "@/lib/prompts";

type Verdict = "green" | "yellow" | "red" | "none";

const VERDICT_STYLES: Record<Verdict, { chip: string; emoji: string }> = {
  green: { chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300", emoji: "✓" },
  yellow: { chip: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300", emoji: "!" },
  red: { chip: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300", emoji: "✗" },
  none: { chip: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300", emoji: "?" },
};

const RESULT_CARD_STYLES: Record<string, string> = {
  green: "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30",
  yellow: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
  red: "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30",
  none: "bg-white dark:bg-slate-900",
};

function VerdictChips({ counts }: { counts: SessionSummary["verdictCounts"] }) {
  const parts: string[] = [];
  if (counts.green) parts.push(`${counts.green} ✓`);
  if (counts.yellow) parts.push(`${counts.yellow} !`);
  if (counts.red) parts.push(`${counts.red} ✗`);
  if (counts.none) parts.push(`${counts.none} ?`);
  if (!parts.length) return null;
  return (
    <span className="text-xs text-slate-500 dark:text-slate-400">
      {parts.join(" · ")}
    </span>
  );
}

type ExpandedEntry = {
  loading: boolean;
  session?: Session;
  error?: string;
};

export default function HistoryPage() {
  const toast = useToast();
  const router = useRouter();

  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ok" | "signed-out" | "not-configured" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Record<string, ExpandedEntry>>({});
  const [allModels, setAllModels] = useState<ModelPreset[]>(BUILTIN_PRESETS);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

  useEffect(() => {
    setApiKeys(loadApiKeys());
    const custom = loadCustomModels();
    setAllModels([...BUILTIN_PRESETS, ...custom]);
    void fetchList();
  }, []);

  async function fetchList() {
    setLoadState("loading");
    const res = await listSessions();
    if (!res.ok) {
      if (res.reason === "not-signed-in") setLoadState("signed-out");
      else if (res.reason === "not-configured") setLoadState("not-configured");
      else { setLoadState("error"); setErrorMsg(res.message ?? "Failed to load history"); }
      return;
    }
    setSummaries(res.sessions);
    setLoadState("ok");
  }

  async function handleExpand(id: string) {
    if (expanded[id]) {
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    setExpanded((prev) => ({ ...prev, [id]: { loading: true } }));
    const res = await loadSession(id);
    if (!res.ok) {
      setExpanded((prev) => ({
        ...prev,
        [id]: { loading: false, error: res.reason === "not-found" ? "Session not found." : (res.message ?? "Failed to load") },
      }));
      return;
    }
    setExpanded((prev) => ({ ...prev, [id]: { loading: false, session: res.session } }));
  }

  async function handleDelete(id: string) {
    const ok = await toast.confirm("Delete this history entry?");
    if (!ok) return;
    const res = await deleteSession(id);
    if (!res.ok) { toast.show("error", "Could not delete entry."); return; }
    setSummaries((prev) => prev.filter((s) => s.id !== id));
    setExpanded((prev) => { const next = { ...prev }; delete next[id]; return next; });
    toast.show("success", "Deleted.");
  }

  async function handleClearAll() {
    const ok = await toast.confirm("Delete all history entries? This cannot be undone.");
    if (!ok) return;
    const res = await clearHistory();
    if (!res.ok) { toast.show("error", "Could not clear history."); return; }
    setSummaries([]);
    setExpanded({});
    toast.show("success", `Cleared ${res.deleted} ${res.deleted === 1 ? "entry" : "entries"}.`);
  }

  async function handleRestore(session: Session) {
    const ok = await toast.confirm("Replace your current draft with this session?");
    if (!ok) return;
    saveDraft({
      userQuestion: session.userQuestion,
      claudeAnswer: session.claudeAnswer,
      documentText: session.documentText,
      docFileName: session.documentFilename,
    });
    const roles: RoleMap = {};
    for (const m of session.selectedModels) {
      roles[m.id] = m.role as RoleMap[string];
    }
    saveSelectedModels(session.selectedModels.map((m) => m.id));
    saveModelRoles(roles);
    router.push("/");
  }

  const filtered = filter
    ? summaries.filter((s) =>
        s.questionPreview.toLowerCase().includes(filter.toLowerCase())
      )
    : summaries;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">History</h1>
          {loadState === "ok" && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {summaries.length} saved {summaries.length === 1 ? "run" : "runs"}
            </p>
          )}
        </div>
        {loadState === "ok" && summaries.length > 0 && (
          <button
            onClick={handleClearAll}
            className="rounded-md border border-rose-300 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30"
          >
            Clear all
          </button>
        )}
      </div>

      {loadState === "loading" && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800" />
          ))}
        </div>
      )}

      {loadState === "signed-out" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/50 dark:bg-amber-950/30">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Sign in to see your verification history.{" "}
            <a href="/login" className="font-medium underline">Sign in →</a>
          </p>
        </div>
      )}

      {loadState === "not-configured" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            History requires an Upstash Redis connection. This deployment doesn&apos;t have one configured.
          </p>
        </div>
      )}

      {loadState === "error" && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-950/30">
          <p className="text-sm text-rose-800 dark:text-rose-300">{errorMsg}</p>
        </div>
      )}

      {loadState === "ok" && summaries.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-slate-500 dark:text-slate-400">
            Your verification runs will appear here once you run a Verify.
          </p>
        </div>
      )}

      {loadState === "ok" && summaries.length > 0 && (
        <>
          <input
            type="search"
            placeholder="Search by question…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-900/40"
          />

          {filtered.length === 0 && (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              No entries match &ldquo;{filter}&rdquo;.
            </p>
          )}

          <div className="space-y-3">
            {filtered.map((s) => {
              const entry = expanded[s.id];
              const isOpen = Boolean(entry);
              return (
                <div
                  key={s.id}
                  className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start gap-3 p-3 sm:p-4">
                    <button
                      onClick={() => handleExpand(s.id)}
                      className="flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatAbsoluteDate(s.createdAt)} · {formatRelativeTime(s.createdAt)}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-600">·</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {s.modelCount} model{s.modelCount === 1 ? "" : "s"}
                        </span>
                        <VerdictChips counts={s.verdictCounts} />
                      </div>
                      <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                        {s.questionPreview || <em className="text-slate-400">No question</em>}
                      </p>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => handleExpand(s.id)}
                        className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                        title={isOpen ? "Collapse" : "Expand"}
                      >
                        {isOpen ? "▾" : "▸"}
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-slate-200 dark:border-slate-800">
                      {entry.loading && (
                        <div className="space-y-2 p-4">
                          <div className="h-3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                          <div className="h-3 w-5/6 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                        </div>
                      )}
                      {entry.error && (
                        <p className="p-4 text-sm text-rose-600 dark:text-rose-400">{entry.error}</p>
                      )}
                      {entry.session && (
                        <ExpandedSession
                          session={entry.session}
                          onRestore={() => handleRestore(entry.session!)}
                          allModels={allModels}
                          apiKeys={apiKeys}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ExpandedSession({
  session,
  onRestore,
  allModels,
  apiKeys,
}: {
  session: Session;
  onRestore: () => void;
  allModels: ModelPreset[];
  apiKeys: Record<string, string>;
}) {
  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="space-y-2">
        {session.userQuestion && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Question</p>
            <p className="text-sm text-slate-800 dark:text-slate-200">{session.userQuestion}</p>
          </div>
        )}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Claude&apos;s answer</p>
          <pre className="max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs whitespace-pre-wrap break-words dark:bg-slate-800/50">
            {session.claudeAnswer}
          </pre>
        </div>
        {session.documentFilename && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Document: <span className="font-medium">{session.documentFilename}</span>
            {session.documentTruncated && " (stored truncated to 30 KB)"}
          </p>
        )}
      </div>

      {(() => {
        const verdictRank = (v: string | undefined): number => {
          if (v === "red") return 0;
          if (v === "yellow") return 1;
          if (v === "green") return 2;
          return 3;
        };
        const displayResults = session.results
          .filter((r) => r.status !== "error")
          .sort((a, b) => verdictRank(a.verdict) - verdictRank(b.verdict));
        const nonGreenResults = displayResults.filter(
          (r) => r.status !== "ok" || (r.verdict ?? "none") !== "green"
        );
        const greenResults = displayResults.filter(
          (r) => r.status === "ok" && r.verdict === "green"
        );

        const renderResult = (r: Session["results"][number], i: number) => {
          const verdict = (r.verdict ?? "none") as Verdict;
          const style = VERDICT_STYLES[verdict];
          const cardStyle = r.status === "ok" ? RESULT_CARD_STYLES[verdict] : "bg-white dark:bg-slate-900";
          const adjs = (session.adjudications ?? []).filter(
            (a) => a.challengerId === r.modelId
          );
          return (
            <details key={i} id={cardAnchorId(r.modelId)} className={`group rounded-lg border ${cardStyle}`}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-slate-400 transition-transform group-open:rotate-90">▸</span>
                  <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{r.modelLabel}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {r.status === "ok" && verdict !== "none" && (
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${style.chip}`}>
                      {style.emoji} {verdict}
                    </span>
                  )}
                  {r.status === "deeplink" && (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      Manual paste
                    </span>
                  )}
                </div>
              </summary>
              <div className="border-t border-slate-200/60 p-3 dark:border-slate-700/60">
                <div className="mb-2 flex justify-end">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      const el = e.currentTarget.closest("details");
                      if (el) el.open = false;
                    }}
                    className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Close
                  </button>
                </div>
              {r.status === "ok" && r.text && (
                <div className="prose prose-sm max-w-none overflow-x-auto break-words dark:prose-invert prose-headings:mt-3 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {r.text.replace(/^\[(GREEN|YELLOW|RED)\]\s*/i, "")}
                  </ReactMarkdown>
                </div>
              )}
              {adjs.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                  {adjs.map((a, j) => {
                    const v = (a.verdict ?? "none") as Verdict;
                    const aStyle = VERDICT_STYLES[v];
                    const verdictText = v === "green"
                      ? "Critique looks correct"
                      : v === "yellow"
                      ? "Critique partially valid"
                      : v === "red"
                      ? "Critique is likely wrong"
                      : "";
                    const aCardStyle = a.status === "ok" ? RESULT_CARD_STYLES[v] : "bg-white dark:bg-slate-900";
                    return (
                      <div key={j} className={`rounded border p-2 ${aCardStyle}`}>
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            Second opinion: {a.adjudicatorLabel}
                          </span>
                          {a.status === "ok" && v !== "none" && (
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${aStyle.chip}`}>
                              {aStyle.emoji} {verdictText}
                            </span>
                          )}
                        </div>
                        {a.status === "ok" && a.text && (
                          <div className="prose prose-xs max-w-none break-words dark:prose-invert prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {a.text.replace(/^\[(GREEN|YELLOW|RED)\]\s*/i, "")}
                            </ReactMarkdown>
                          </div>
                        )}
                        {a.status === "error" && (
                          <p className="text-xs text-rose-700 dark:text-rose-300">{a.error}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
            </details>
          );
        };

        const scoreboardEntries: ScoreboardEntry[] = displayResults
          .filter((r) => r.status === "ok")
          .map((r) => ({
            id: r.modelId,
            label: r.modelLabel,
            verdict: (r.verdict ?? "none") as Verdict,
            excerpt: r.text ? extractExcerpt(r.text.replace(/^\[(GREEN|YELLOW|RED)\]\s*/i, "")) : undefined,
          }));

        const consolidationCritiques: ConsolidationCritique[] = displayResults
          .filter((r) => r.status === "ok" && (r.verdict === "red" || r.verdict === "yellow"))
          .map((r) => ({
            modelLabel: r.modelLabel,
            verdict: r.verdict as "red" | "yellow",
            body: r.text ? r.text.replace(/^\[(GREEN|YELLOW|RED)\]\s*/i, "") : "",
          }));

        return (
          <div className="space-y-3">
            <VerdictScoreboard entries={scoreboardEntries} />
            {consolidationCritiques.length >= 1 && (
              <ConsolidatePanel
                critiques={consolidationCritiques}
                claudeAnswer={session.claudeAnswer}
                documentText={session.documentText}
                userQuestion={session.userQuestion}
                availableModels={allModels}
                apiKeys={apiKeys}
              />
            )}
            {(nonGreenResults.length > 0 || greenResults.length > 0) && (
              <div className="flex items-center gap-3 pt-2">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Original responses · click any card to expand
                </span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              </div>
            )}
            {nonGreenResults.map((r, i) => renderResult(r, i))}
            {greenResults.length > 0 && (
              <details className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <summary className="cursor-pointer p-3 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  ✓ {greenResults.length} confirmed correct — click to expand
                </summary>
                <div className="space-y-3 border-t border-emerald-200/60 p-3 dark:border-emerald-900/40">
                  {greenResults.map((r, i) => renderResult(r, nonGreenResults.length + i))}
                </div>
              </details>
            )}
          </div>
        );
      })()}

      <div className="flex justify-end">
        <button
          onClick={onRestore}
          className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/50"
        >
          Restore to editor
        </button>
      </div>
    </div>
  );
}
