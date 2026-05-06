import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentSession } from "@/lib/auth/session";
import { SignOutButton } from "@/components/SignOutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ToastProvider } from "@/components/Toast";
import { MobileMenu } from "@/components/MobileMenu";

export const metadata: Metadata = {
  title: "Legal Research Cross-Verifier",
  description: "Paste an AI answer, upload a document, and verify with multiple free AI models.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('lr.theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var theme = stored === 'dark' || stored === 'light'
                    ? stored
                    : (prefersDark ? 'dark' : 'light');
                  if (theme === 'dark') document.documentElement.classList.add('dark');
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen">
        <ToastProvider>
          <Header session={session} />
          <main className="mx-auto max-w-6xl px-3 py-4 pb-40 sm:px-4 sm:py-6 sm:pb-32">
            {children}
          </main>
          <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-slate-500 dark:text-slate-400">
              Your API keys are stored only in this browser. The site sends prompts straight to the
              provider you pick — no central database.
            </div>
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}

type SessionInfo = { email: string } | null;

const MOBILE_NAV_LINKS = [
  { href: "/", label: "Verify" },
  { href: "/prompts", label: "Prompts" },
  { href: "/citation-test", label: "Citations" },
  { href: "/diag", label: "Diagnostics" },
  { href: "/settings", label: "Settings" },
];

function Header({ session }: { session: SessionInfo }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:px-4">

        {/* Logo */}
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-600 text-sm font-bold text-white dark:bg-blue-500">
            LR
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              Legal Research <span className="hidden sm:inline">Cross-Verifier</span>
            </span>
            <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:inline">
              Compare AI answers against your source document
            </span>
          </span>
        </Link>

        {/* Desktop nav (hidden on xs) */}
        <nav className="hidden shrink-0 items-center gap-1 text-sm sm:flex sm:gap-2">
          <Link href="/" className="rounded px-2 py-1 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            Verify
          </Link>
          <Link href="/prompts" className="rounded px-2 py-1 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            Prompts
          </Link>
          <Link href="/citation-test" className="rounded px-2 py-1 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            Citations
          </Link>
          {session && (
            <Link href="/history" className="rounded px-2 py-1 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              History
            </Link>
          )}
          <Link href="/diag" className="rounded px-2 py-1 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            Diag
          </Link>
          <Link
            href="/settings"
            className="rounded-md border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Settings
          </Link>
          <ThemeToggle />
          {session ? (
            <span className="flex items-center gap-2 border-l border-slate-200 pl-2 dark:border-slate-700">
              <span className="hidden max-w-[14ch] truncate text-xs text-slate-500 dark:text-slate-400 md:inline">
                {session.email}
              </span>
              <SignOutButton />
            </span>
          ) : (
            <Link
              href="/login"
              className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60"
            >
              Sign in
            </Link>
          )}
        </nav>

        {/* Mobile right side: theme toggle + hamburger */}
        <div className="flex items-center gap-1 sm:hidden">
          <ThemeToggle />
          {session ? (
            <SignOutButton />
          ) : (
            <Link
              href="/login"
              className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
            >
              Sign in
            </Link>
          )}
          <MobileMenu links={MOBILE_NAV_LINKS} isLoggedIn={Boolean(session)} />
        </div>

      </div>
    </header>
  );
}
