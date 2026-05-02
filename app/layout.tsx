import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentSession } from "@/lib/auth/session";
import { SignOutButton } from "@/components/SignOutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Legal Research Cross-Verifier — Don't trust one AI",
  description:
    "Cross-check AI legal answers with a panel of independent models. Catch hallucinations, missed authorities, and weak reasoning before they reach your client.",
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
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <ToastProvider>
          <Header session={session} />
          <main className="mx-auto max-w-6xl px-3 py-6 pb-40 sm:px-4 sm:py-8 sm:pb-32">
            {children}
          </main>
          <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <BrandMark className="h-4 w-4" />
                <span className="font-medium text-slate-700 dark:text-slate-300">Legal Research Cross-Verifier</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Keys stay in your browser
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  No central database
                </span>
                <Link href="/settings" className="hover:text-slate-700 dark:hover:text-slate-300">Settings</Link>
                <Link href="/prompts" className="hover:text-slate-700 dark:hover:text-slate-300">Prompts</Link>
              </div>
            </div>
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}

type SessionInfo = { email: string } | null;

function BrandMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2.5 4 5.5v6.2c0 4.6 3.2 8.7 8 9.8 4.8-1.1 8-5.2 8-9.8V5.5l-8-3Z"
        className="fill-blue-600 dark:fill-blue-500"
      />
      <path
        d="m8.5 12.2 2.5 2.5 4.5-5"
        className="stroke-white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Header({ session }: { session: SessionInfo }) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:px-4">
            <Link href="/" className="flex min-w-0 items-center gap-2">
              <BrandMark className="h-7 w-7 shrink-0" />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Legal Research <span className="hidden sm:inline">Cross-Verifier</span>
                </span>
                <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:inline">
                  Cross-check AI legal answers with independent models
                </span>
              </span>
            </Link>
            <nav className="flex shrink-0 items-center gap-1 text-sm sm:gap-3">
              <Link
                href="/"
                className="rounded px-2 py-1 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Verify
              </Link>
              <Link
                href="/prompts"
                className="rounded px-2 py-1 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Prompts
              </Link>
              {session && (
                <Link
                  href="/history"
                  className="rounded px-2 py-1 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  History
                </Link>
              )}
              <Link
                href="/settings"
                className="rounded-md border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:px-3"
              >
                Settings
              </Link>
              <ThemeToggle />
              {session ? (
                <span className="flex items-center gap-2 border-l border-slate-200 pl-2 dark:border-slate-700 sm:pl-3">
                  <span className="hidden max-w-[14ch] truncate text-xs text-slate-500 dark:text-slate-400 md:inline">
                    {session.email}
                  </span>
                  <SignOutButton />
                </span>
              ) : (
                <Link
                  href="/login"
                  className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 sm:px-3"
                >
                  Sign in
                </Link>
              )}
            </nav>
          </div>
        </header>
    </>
  );
}
