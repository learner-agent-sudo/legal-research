"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = (await res.json()) as { ok?: boolean; emailed?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      const params = new URLSearchParams({ email: email.trim() });
      if (json.emailed === false) params.set("noEmail", "1");
      router.push(`/login/verify?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Sign in</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Enter your email. We&apos;ll send a 6-digit code to confirm it&apos;s you.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-900/40"
            placeholder="you@example.com"
          />
        </label>
        {error && <p className="rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-400 dark:bg-blue-500 dark:hover:bg-blue-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
        >
          {loading ? "Sending…" : "Send code"}
        </button>
      </form>

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Sign-in is optional. The app still works without an account using browser-stored
        keys. Logging in just lets your keys follow you to other devices.{" "}
        <Link href="/" className="text-blue-600 hover:underline dark:text-blue-400">
          Back home
        </Link>
      </p>
    </div>
  );
}
