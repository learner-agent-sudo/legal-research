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
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      router.push(`/login/verify?email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-slate-600">
        Enter your email. We&apos;ll send a 6-digit code to confirm it&apos;s you.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 rounded-lg border bg-white p-4 shadow-sm"
      >
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border p-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200"
            placeholder="you@example.com"
          />
        </label>
        {error && <p className="rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-400"
        >
          {loading ? "Sending…" : "Send code"}
        </button>
      </form>

      <p className="mt-3 text-xs text-slate-500">
        Sign-in is optional. The app still works without an account using browser-stored
        keys. Logging in just lets your keys follow you to other devices.{" "}
        <Link href="/" className="text-blue-600 hover:underline">
          Back home
        </Link>
      </p>
    </div>
  );
}
