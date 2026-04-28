import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Apple-style system font stack: SF Pro on Apple, Segoe UI on Windows,
        // Roboto on Android, sans-serif fallback elsewhere.
        sans: [
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"Helvetica Neue"',
          '"Segoe UI"',
          "Roboto",
          '"Inter var"',
          "Inter",
          "system-ui",
          "sans-serif",
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
        ],
        mono: [
          "ui-monospace",
          '"SF Mono"',
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          '"Liberation Mono"',
          "monospace",
        ],
      },
      letterSpacing: {
        // Apple's display headings use slight negative tracking
        "tight-apple": "-0.011em",
        "tighter-apple": "-0.022em",
      },
    },
  },
  plugins: [typography],
};

export default config;
