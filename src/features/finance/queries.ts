import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { FinanceError, type FinanceOptions } from "./types";

// Maps PostgreSQL error codes from the financial RPCs and tables to safe, user-facing errors.
export function financeDatabaseError(error: { code?: string }): never {
  if (error.code === "42501") throw new FinanceError(403, "Your current account is not allowed to make this change.");
  if (error.code === "P0002") throw new FinanceError(404, "Record not found.");
  if (["40001", "23505"].includes(error.code ?? ""))
    throw new FinanceError(
      409,
      "This submission conflicts with an existing record or a newer draft. Reload and review before trying again.",
    );
  if (["23514", "23503", "23502", "22P02", "22007", "22008", "22003", "22023"].includes(error.code ?? ""))
    throw new FinanceError(
      422,
      "Review amounts, allocation totals, active employees/verticals and linked opportunity details.",
    );
  throw new FinanceError(503, "Financial records are temporarily unavailable.");
}

export async function loadFinanceOptions(client: SupabaseClient<Database>): Promise<FinanceOptions> {
  const [employees, verticals] = await Promise.all([
    client
      .from("profiles")
      .select("id,display_name,active")
      .eq("department", "PSE")
      .in("role", ["pse_member", "pse_manager", "admin"])
      .order("display_name")
      .order("id")
      .limit(1000),
    client.from("target_verticals").select("*").order("name").order("id").limit(1000),
  ]);
  if (employees.error) financeDatabaseError(employees.error);
  if (verticals.error) financeDatabaseError(verticals.error);
  return { employees: employees.data ?? [], verticals: verticals.data ?? [] };
}
