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
      <body>
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-semibold">
              Legal Research Cross-Verifier
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/" className="hover:underline">Verify</Link>
              <Link href="/settings" className="hover:underline">Settings</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
