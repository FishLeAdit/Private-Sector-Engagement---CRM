import type { Tables } from "@/types/database.types";

export type PseRole = "pse_member" | "pse_manager" | "admin";

export type AccessProfile = Pick<Tables<"profiles">, "id" | "display_name" | "department" | "role" | "active">;
export type PseProfile = AccessProfile & { role: PseRole };

export function isActivePseProfile(profile: AccessProfile | null): profile is PseProfile {
  return (
    !!profile &&
    profile.active &&
    profile.department === "PSE" &&
    ["pse_member", "pse_manager", "admin"].includes(profile.role)
  );
}

export function canManageTargets(profile: AccessProfile | null): boolean {
  return isPseManager(profile);
}

export function isPseManager(profile: AccessProfile | null): boolean {
  return isActivePseProfile(profile) && ["pse_manager", "admin"].includes(profile.role);
}

export const roleLabels: Record<PseRole, string> = {
  pse_member: "PSE member",
  pse_manager: "PSE manager",
  admin: "Administrator",
};
