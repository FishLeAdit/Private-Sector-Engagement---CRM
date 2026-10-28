"use client";
import { useState } from "react";

type Theme = "dark" | "light";

// Switches between the two avionics themes and remembers the choice for a year (cookie read by src/lib/theme.ts).
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm font-mono text-xs uppercase tracking-wider"
      onClick={() => {
        document.cookie = `pse-theme=${next}; path=/; max-age=31536000; samesite=lax`;
        document.documentElement.dataset.theme = `avionics-${next}`;
        setTheme(next);
      }}
    >
      <span aria-hidden="true" className="pip text-decor" />
      {next === "light" ? "Light theme" : "Dark theme"}
    </button>
  );
}
