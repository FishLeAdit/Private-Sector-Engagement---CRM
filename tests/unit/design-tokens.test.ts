import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Reads both avionics themes straight from globals.css and checks WCAG 2 contrast, so a token change that
// makes text unreadable fails here rather than in review.
const css = readFileSync(resolve("src/app/globals.css"), "utf8");

function block(pattern: RegExp) {
  const match = css.match(pattern);
  if (!match) throw new Error(`Theme block not found: ${pattern}`);
  return Object.fromEntries(
    [...match[1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()]),
  );
}
const themes = {
  dark: {
    ...block(/name: "avionics-dark";([\s\S]*?)\n}/),
    ...block(/:root,\s*\[data-theme="avionics-dark"\] \{([\s\S]*?)\n}/),
  },
  light: {
    ...block(/name: "avionics-light";([\s\S]*?)\n}/),
    ...block(/\[data-theme="avionics-light"\] \{([\s\S]*?)\n}/),
  },
};

type Rgb = [number, number, number];
function parse(color: string): { rgb: Rgb; alpha: number } {
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) return { rgb: [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16)) as Rgb, alpha: 1 };
  const rgb = color.match(/^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/);
  if (rgb) return { rgb: [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])], alpha: Number(rgb[4]) };
  throw new Error(`Unsupported colour ${color}`);
}
// A translucent surface as it appears over the page background.
function over(top: string, bottom: string): Rgb {
  const { rgb, alpha } = parse(top),
    base = parse(bottom).rgb;
  return rgb.map((channel, i) => Math.round(channel * alpha + base[i] * (1 - alpha))) as Rgb;
}
function luminance([r, g, b]: Rgb) {
  const [R, G, B] = [r, g, b].map(v => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function contrast(a: Rgb, b: Rgb) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

describe.each(Object.entries(themes))("%s avionics theme", (_, t) => {
  const page = parse(t["color-base-100"]).rgb;
  const surfaces = {
    page,
    raised: parse(t["color-base-200"]).rgb,
    panel: over(t["hud-surface"], t["color-base-100"]),
  };
  const on = (token: string) => parse(t[token]).rgb;

  it.each(Object.entries(surfaces))("keeps body and small metadata text readable on the %s surface", (_, surface) => {
    expect(contrast(on("color-base-content"), surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(on("hud-muted"), surface)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(["success", "warning", "error", "info"])("keeps %s text readable on the page and panels", status => {
    expect(contrast(on(`color-${status}`), surfaces.page)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(on(`color-${status}`), surfaces.panel)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(["primary", "accent", "info", "success", "warning", "error", "neutral"])(
    "keeps %s button text readable",
    role => {
      expect(contrast(on(`color-${role}-content`), on(`color-${role}`))).toBeGreaterThanOrEqual(4.5);
    },
  );
  it("keeps focus rings and decorative strings visible (3:1 for non-text and large text)", () => {
    expect(contrast(on("color-accent"), surfaces.page)).toBeGreaterThanOrEqual(3);
    expect(contrast(on("hud-decor"), surfaces.page)).toBeGreaterThanOrEqual(3);
  });
});
