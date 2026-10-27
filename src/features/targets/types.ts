import type { Tables } from "@/types/database.types";

export type TargetPlan = Tables<"target_plans"> & {
  quarters: Tables<"target_quarters">[];
  creator: { display_name: string } | null;
  approver: { display_name: string } | null;
};
export type Allocation = Tables<"target_allocations"> & {
  employee: { display_name: string } | null;
  vertical: { name: string } | null;
};
// Recognized support for one plan, summed per quarter and attribution (vertical may be unassigned).
export type Actual = { quarter: number; employee_id: string; vertical_id: string | null; amount: string };
