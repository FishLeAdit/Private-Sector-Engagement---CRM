import "server-only";
import { cookies } from "next/headers";

// The colour theme is a per-browser preference kept in a cookie, so the server renders the right theme first
// and nothing flashes. Dark is the default. components/ui/theme-toggle.tsx writes the same cookie.
export const THEME_COOKIE = "pse-theme";
export type ThemeName = "dark" | "light";

export async function currentTheme(): Promise<ThemeName> {
  return (await cookies()).get(THEME_COOKIE)?.value === "light" ? "light" : "dark";
}
