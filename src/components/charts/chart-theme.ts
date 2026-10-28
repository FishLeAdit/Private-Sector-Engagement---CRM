"use client";
import { useMemo, useSyncExternalStore } from "react";

// recharts draws SVG from explicit colours, so charts read the live theme tokens (globals.css) and re-read them
// whenever the theme toggle changes data-theme. The emphasis scheme: accent for what matters, neutral for context.
export type ChartTheme = {
  accent: string;
  neutral: string;
  soft: string;
  grid: string;
  text: string;
  muted: string;
  surface: string;
};

const darkDefaults: ChartTheme = {
  accent: "#3b82f6",
  neutral: "#64748b",
  soft: "#1e3a8a",
  grid: "#1e293b",
  text: "#f2f4f7",
  muted: "#8492a6",
  surface: "#0b0f19",
};

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function readTheme(name: string): ChartTheme {
  if (typeof document === "undefined" || !name) return darkDefaults;
  const style = getComputedStyle(document.documentElement);
  const token = (property: string, fallback: string) => style.getPropertyValue(property).trim() || fallback;
  return {
    accent: token("--chart-accent", darkDefaults.accent),
    neutral: token("--chart-neutral", darkDefaults.neutral),
    soft: token("--chart-soft", darkDefaults.soft),
    grid: token("--color-base-300", darkDefaults.grid),
    text: token("--color-base-content", darkDefaults.text),
    muted: token("--hud-muted", darkDefaults.muted),
    surface: token("--color-base-100", darkDefaults.surface),
  };
}

export function useChartTheme() {
  const name = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.theme ?? "avionics-dark",
    () => "",
  );
  return useMemo(() => readTheme(name), [name]);
}

export const monoFont = "var(--font-jetbrains-mono), ui-monospace, monospace";
