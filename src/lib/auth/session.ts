import type { AccessProfile, PseProfile } from "./roles";
import { isActivePseProfile } from "./roles";

export type AccessResult =
  | { status: "allowed"; userId: string; profile: PseProfile }
  | { status: "anonymous" | "forbidden" | "unavailable" };

export type AccessDependencies = {
  verifyUser: () => Promise<{ id: string } | null>;
  loadProfile: (userId: string) => Promise<AccessProfile | null>;
};

export async function resolveAccess(deps: AccessDependencies): Promise<AccessResult> {
  try {
    const user = await deps.verifyUser();
    if (!user) return { status: "anonymous" };
    const profile = await deps.loadProfile(user.id);
    if (!isActivePseProfile(profile) || profile.id !== user.id) return { status: "forbidden" };
    return { status: "allowed", userId: user.id, profile };
  } catch {
    // An unavailable identity/profile provider never grants access.
    return { status: "unavailable" };
  }
}

const protectedRoots = ["dashboard", "contacts", "opportunities", "meetings", "activities", "contributions", "targets", "reports", "settings"];

export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return "/dashboard";
  try {
    const url = new URL(value, "https://return.invalid");
    const decodedPath = decodeURIComponent(url.pathname);
    if (url.origin !== "https://return.invalid" || /[\\\u0000-\u001f\u007f]/.test(decodedPath)) return "/dashboard";
    if (!protectedRoots.some(root => decodedPath === `/${root}` || decodedPath.startsWith(`/${root}/`))) return "/dashboard";
    return `${url.pathname}${url.search}`;
  } catch { return "/dashboard"; }
}
