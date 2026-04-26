import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Legal Research Cross-Verifier",
  description: "Paste an AI answer, upload a document, and verify with multiple free AI models.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="text-slate-700 hover:text-slate-900">
                Verify
              </Link>
              <Link
                href="/settings"
                className="rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50"
              >
                Settings
              </Link>
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
