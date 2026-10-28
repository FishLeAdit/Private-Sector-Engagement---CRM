import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { AccountUpdateInput } from "./schemas";
import { AccountError, type Account } from "./types";

function databaseError(error: { code?: string }): never {
  if (error.code === "42501") throw new AccountError(403, "Only a superadmin can manage accounts.");
  if (error.code === "P0002") throw new AccountError(404, "Account not found.");
  if (["23503", "23001"].includes(error.code ?? ""))
    throw new AccountError(
      409,
      "This account has records or history in the CRM, so it cannot be deleted. Restrict it instead.",
    );
  if (["23514", "23502", "22P02"].includes(error.code ?? ""))
    throw new AccountError(422, "Review the account details.");
  throw new AccountError(503, "Accounts are temporarily unavailable. Please try again.");
}

// Profile reads and writes with the caller's own client: the SQL functions check for a superadmin again.
export function createAccountRepository(client: SupabaseClient<Database>) {
  return {
    async list(): Promise<Account[]> {
      const { data, error } = await client.rpc("admin_list_accounts");
      if (error) databaseError(error);
      return (data ?? []) as Account[];
    },
    async save(id: string, values: AccountUpdateInput) {
      const { error } = await client.rpc("admin_save_profile", {
        p_id: id,
        p_display_name: values.display_name,
        p_department: values.department,
        p_role: values.role,
        p_active: values.active,
      });
      if (error) databaseError(error);
    },
    // False when the account has no profile to delete.
    async remove(id: string) {
      const { error } = await client.rpc("admin_delete_profile", { p_id: id });
      if (error?.code === "P0002") return false;
      if (error) databaseError(error);
      return true;
    },
  };
}
export type AccountRepository = ReturnType<typeof createAccountRepository>;
