"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: code.trim() }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Enter the 6-digit code</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        We sent a code to <strong>{email}</strong>. It expires in 10 minutes.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Code</span>
          <input
            type="text"
            required
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-center text-2xl font-mono tracking-widest placeholder:text-slate-300 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-700 dark:focus:border-blue-500 dark:focus:ring-blue-900/40"
            placeholder="000000"
          />
        </label>
        {error && <p className="rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-400 dark:bg-blue-500 dark:hover:bg-blue-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
        >
          {loading ? "Verifying…" : "Sign in"}
        </button>
      </form>

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Didn&apos;t get the email? Check spam, then{" "}
        <Link href="/login" className="text-blue-600 hover:underline dark:text-blue-400">
          request a new code
        </Link>
        .
      </p>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md text-sm text-slate-500">Loading…</div>
      }
    >
      <VerifyForm />
    </Suspense>
  );
}
