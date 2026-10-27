import type { AppErrorClass } from "@/lib/errors";
import { isActivePseProfile, type PseProfile } from "./roles";
import type { AccessResult } from "./session";

export type VerifiedPseAccess = { status: "allowed"; userId: string; profile: PseProfile };

// Signed in, the session user matches the loaded profile, and that profile is active PSE staff.
export function isVerifiedPse(access: AccessResult): access is VerifiedPseAccess {
  return access.status === "allowed" && isActivePseProfile(access.profile) && access.userId === access.profile.id;
}

export function assertVerifiedPse(access: AccessResult, ErrorClass: AppErrorClass, message: string) {
  if (!isVerifiedPse(access)) {
    const status = access.status === "anonymous" ? 401 : access.status === "unavailable" ? 503 : 403;
    throw new ErrorClass(status, message);
  }
  return access;
}
