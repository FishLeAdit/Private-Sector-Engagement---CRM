import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
import { financeDatabaseError, loadFinanceOptions } from "@/features/finance/queries";
import { FinanceError } from "@/features/finance/types";
import type { TargetInput, VerticalInput } from "./schemas";
import type { Actual, Allocation } from "./types";

export function createTargetRepository(client: SupabaseClient<Database>) {
  return {
    options: () => loadFinanceOptions(client),

    async plans(page: number) {
      const { data, count, error } = await client
        .from("target_plans")
        .select("*", { count: "exact" })
        .order("year", { ascending: false })
        .order("currency")
        .range((page - 1) * 20, page * 20 - 1);
      if (error) financeDatabaseError(error);
      return { plans: data ?? [], count: count ?? 0 };
    },

    async plan(id: string) {
      const { data, error } = await client
        .from("target_plans")
        .select("*,quarters:target_quarters(*),creator:created_by(display_name),approver:approved_by(display_name)")
        .eq("id", id)
        .maybeSingle();
      if (error) financeDatabaseError(error);
      return data;
    },

    // Reads past the default 1,000-row REST limit, up to the supported 4,000 cells.
    async allocations(id: string) {
      const rows: Allocation[] = [];
      for (let start = 0; start <= 4000; start += 1000) {
        const { data, count, error } = await client
          .from("target_allocations")
          .select("*,employee:employee_id(display_name),vertical:vertical_id(name)", { count: "exact" })
          .eq("plan_id", id)
          .order("quarter")
          .order("employee_id")
          .order("vertical_id")
          .range(start, start + 999);
        if (error) financeDatabaseError(error);
        rows.push(...(data ?? []));
        if ((count ?? 0) > 4000 || rows.length > 4000)
          throw new FinanceError(422, "This plan exceeds the supported 4,000 allocation cells.");
        if ((data?.length ?? 0) < 1000) break;
      }
      return rows;
    },

    async actuals(id: string) {
      const { data, error } = await client.rpc("target_actuals", { p_plan_id: id });
      if (error) financeDatabaseError(error);
      return (data ?? []) as unknown as Actual[];
    },

    // Replaces the whole draft atomically; the RPC rejects the save if the draft changed since it was loaded.
    async save(input: TargetInput) {
      const { request_id, expected_updated_at, ...values } = input;
      const { data, error } = await client.rpc("save_target_draft", {
        p_id: request_id,
        p_values: values as Json,
        p_expected_updated_at: expected_updated_at,
      });
      if (error) financeDatabaseError(error);
      return data!;
    },

    async approve(id: string, stamp: string) {
      const { data, error } = await client.rpc("approve_target_draft", { p_plan_id: id, p_expected_updated_at: stamp });
      if (error) financeDatabaseError(error);
      return data!;
    },

    async vertical(input: VerticalInput) {
      const query = input.id
        ? client.from("target_verticals").update(input.values).eq("id", input.id)
        : client.from("target_verticals").insert(input.values);
      const { data, error } = await query.select("id").maybeSingle();
      if (error) financeDatabaseError(error);
      if (!data) throw new FinanceError(403, "Vertical could not be saved.");
      return data;
    },

    async history(id: string) {
      const { data, error } = await client
        .from("audit_logs")
        .select("id,action,created_at,actor:actor_id(display_name)")
        .eq("entity", "target_plans")
        .eq("entity_id", id)
        .order("created_at", { ascending: false })
        .order("id")
        .limit(20);
      if (error) financeDatabaseError(error);
      return data ?? [];
    },
  };
}
export type TargetRepository = ReturnType<typeof createTargetRepository>;
