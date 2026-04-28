"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function readStored(): Theme {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem("lr.theme");
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

function effectiveTheme(t: Theme): "light" | "dark" {
  if (t === "system") {
    return typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return t;
}

function applyTheme(t: Theme) {
  if (typeof window === "undefined") return;
  const eff = effectiveTheme(t);
  // brief transition class so colors animate, then drop it so other
  // animations aren't slowed
  document.documentElement.classList.add("theme-transition");
  document.documentElement.classList.toggle("dark", eff === "dark");
  if (t === "system") {
    window.localStorage.removeItem("lr.theme");
  } else {
    window.localStorage.setItem("lr.theme", t);
  }
  window.setTimeout(() => {
    document.documentElement.classList.remove("theme-transition");
  }, 250);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readStored());
    setMounted(true);

    // Live-react to OS theme changes when user is in "system" mode
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readStored() === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function cycle() {
    const next: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
    applyTheme(next);
  }

  if (!mounted) {
    return (
      <button
        aria-label="Theme"
        className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-slate-500"
      >
        ◐
      </button>
    );
  }

  const label =
    theme === "system" ? "System theme (click to switch)" :
    theme === "light"  ? "Light theme (click to switch)" :
                         "Dark theme (click to switch)";
  const glyph =
    theme === "system" ? "◐" :
    theme === "light"  ? "☀" :
                         "☾";

  return (
    <button
      type="button"
      onClick={cycle}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-base text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {glyph}
    </button>
  );
}
