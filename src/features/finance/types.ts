import type { Tables } from "@/types/database.types";
import { AppError } from "@/lib/errors";

// Shared by the contributions and targets modules, so both map failures the same way.
export class FinanceError extends AppError {
  name = "FinanceError";
}

// The employees and target verticals that receipts and target allocations can be attributed to.
export type FinanceOptions = {
  employees: Pick<Tables<"profiles">, "id" | "display_name" | "active">[];
  verticals: Tables<"target_verticals">[];
};
