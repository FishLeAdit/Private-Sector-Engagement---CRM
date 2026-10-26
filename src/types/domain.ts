import type { Tables } from "./database.types";

export type PseRole = "pse_member" | "pse_manager" | "admin";
export type ContactKind = "individual" | "company";
export type ContributionType = "cash" | "valued_in_kind";
export type ActivityType = "task" | "email" | "call" | "meeting" | "event" | "campaign" | "proposal" | "visit" | "stewardship" | "prospect_engagement" | "general";
export type WorkCategory = "stewardship" | "prospect_engagement" | "independent_general";
export type Quarter = 1 | 2 | 3 | 4;
export type Contact = Omit<Tables<"contacts">, "kind"> & { kind: ContactKind };
export type RecognizedContribution = Omit<Tables<"recognized_contributions">, "contribution_type"> & { contribution_type: ContributionType };
// Pipeline stage/category/vertical labels are data, not finalized domain enums.
