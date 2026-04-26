import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentSession } from "@/lib/auth/session";
import { SignOutButton } from "@/components/SignOutButton";

export const metadata: Metadata = {
  title: "Legal Research Cross-Verifier",
  description: "Paste an AI answer, upload a document, and verify with multiple free AI models.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-sm font-bold text-white">
                LR
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-semibold">Legal Research Cross-Verifier</span>
                <span className="text-xs text-slate-500">
                  Compare AI answers against your source document
                </span>
              </span>
            </Link>
            <nav className="flex items-center gap-3 text-sm">
              <Link href="/" className="text-slate-700 hover:text-slate-900">
                Verify
              </Link>
              <Link href="/prompts" className="text-slate-700 hover:text-slate-900">
                Prompts
              </Link>
              <Link
                href="/settings"
                className="rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50"
              >
                Settings
              </Link>
              {session ? (
                <span className="flex items-center gap-2 border-l pl-3">
                  <span className="hidden text-xs text-slate-500 sm:inline">
                    {session.email}
                  </span>
                  <SignOutButton />
                </span>
              ) : (
                <Link
                  href="/login"
                  className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-100"
                >
                  Sign in
                </Link>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 pb-32">{children}</main>
        <footer className="border-t bg-white">
          <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-slate-500">
            Your API keys are stored only in this browser. The site sends prompts straight to the
            provider you pick — no central database.
          </div>
        </footer>
      </body>
    </html>
  );
}
