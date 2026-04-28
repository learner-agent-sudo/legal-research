"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type ToastKind = "info" | "success" | "warn" | "error";
type Toast = { id: number; kind: ToastKind; message: string };

type ToastContextValue = {
  show: (kind: ToastKind, message: string) => void;
  confirm: (message: string) => Promise<boolean>;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback if provider isn't mounted (e.g. test or SSR boundary)
    return {
      show: (_, m) => {
        if (typeof window !== "undefined") window.alert(m);
      },
      confirm: async (m) => (typeof window !== "undefined" ? window.confirm(m) : false),
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<{
    message: string;
    resolve: (v: boolean) => void;
  } | null>(null);

  const show = useCallback((kind: ToastKind, message: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const confirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ message, resolve });
    });
  }, []);

  // Esc cancels the confirm dialog
  useEffect(() => {
    if (!confirmState) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        confirmState!.resolve(false);
        setConfirmState(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmState]);

  return (
    <ToastContext.Provider value={{ show, confirm }}>
      {children}

      {/* Stacked toasts — bottom-right, dismiss after timeout */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              "pointer-events-auto max-w-sm rounded-lg border px-3 py-2 text-sm shadow-lg backdrop-blur " +
              kindClasses(t.kind)
            }
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Confirm modal */}
      {confirmState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              confirmState.resolve(false);
              setConfirmState(null);
            }
          }}
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm text-slate-800 dark:text-slate-200">{confirmState.message}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  confirmState.resolve(false);
                  setConfirmState(null);
                }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                autoFocus
                onClick={() => {
                  confirmState.resolve(true);
                  setConfirmState(null);
                }}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

function kindClasses(kind: ToastKind): string {
  switch (kind) {
    case "success":
      return "border-emerald-300 bg-emerald-50/95 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200";
    case "warn":
      return "border-amber-300 bg-amber-50/95 text-amber-900 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-200";
    case "error":
      return "border-rose-300 bg-rose-50/95 text-rose-900 dark:border-rose-800 dark:bg-rose-950/80 dark:text-rose-200";
    case "info":
    default:
      return "border-slate-300 bg-white/95 text-slate-800 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200";
  }
}
