import type { Tables } from "@/types/database.types";
import { AppError } from "@/lib/errors";

export class FinanceError extends AppError {
  name = "FinanceError";
}
export type FinanceOptions = {
  employees: Pick<Tables<"profiles">, "id" | "display_name" | "active">[];
  verticals: Tables<"target_verticals">[];
};
export type Contribution = Tables<"recognized_contributions"> & {
  opportunity: { id: string; deal_name: string } | null;
  employee: { display_name: string } | null;
  vertical: { name: string } | null;
  recorder: { display_name: string } | null;
};
export type TargetPlan = Tables<"target_plans"> & {
  quarters: Tables<"target_quarters">[];
  creator: { display_name: string } | null;
  approver: { display_name: string } | null;
};
export type Allocation = Tables<"target_allocations"> & {
  employee: { display_name: string } | null;
  vertical: { name: string } | null;
};
export type Actual = { quarter: number; employee_id: string; vertical_id: string | null; amount: string };
