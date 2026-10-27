import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { financeDatabaseError, loadFinanceOptions } from "@/features/finance/queries";
import { FinanceError } from "@/features/finance/types";
import { fromDhakaDateTimeInput } from "@/lib/dates";
import { isPastLastPage } from "@/lib/supabase/pagination";
import type { ContributionFilters, ContributionInput } from "./schemas";
import type { Contribution } from "./types";

const contributionSelect =
  "*,opportunity:opportunity_id(id,deal_name),employee:employee_id(display_name),vertical:target_vertical_id(name),recorder:recorded_by(display_name)" as const;

export function createContributionRepository(client: SupabaseClient<Database>) {
  async function find(id: string) {
    const { data, error } = await client
      .from("recognized_contributions")
      .select(contributionSelect)
      .eq("id", id)
      .maybeSingle();
    if (error) financeDatabaseError(error);
    return data;
  }

  return {
    options: () => loadFinanceOptions(client),

    async opportunity(id: string) {
      const { data, error } = await client
        .from("opportunities")
        .select(
          "id,deal_name,owner_id,currency,contribution_type,expected_amount,stage:stage_id(name,is_closed,outcome)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) financeDatabaseError(error);
      return data;
    },

    // Date filters are whole Asia/Dhaka days: from midnight on "from" to midnight after "to".
    async contributions(input: ContributionFilters): Promise<{ contributions: Contribution[]; count: number }> {
      let query = client.from("recognized_contributions").select(contributionSelect, { count: "exact" });
      for (const key of ["opportunity_id", "employee_id", "target_vertical_id", "currency"] as const)
        if (input[key]) query = query.eq(key, input[key]);
      if (input.from) query = query.gte("recognized_at", fromDhakaDateTimeInput(`${input.from}T00:00`));
      if (input.to) {
        const day = new Date(`${input.to}T00:00Z`);
        day.setUTCDate(day.getUTCDate() + 1);
        query = query.lt("recognized_at", fromDhakaDateTimeInput(`${day.toISOString().slice(0, 10)}T00:00`));
      }
      const { data, count, error } = await query
        .order("recognized_at", { ascending: false })
        .order("id")
        .range((input.page - 1) * 20, input.page * 20 - 1);
      if (isPastLastPage(error) && input.page > 1)
        return { contributions: [], count: (await this.contributions({ ...input, page: 1 })).count };
      if (error) financeDatabaseError(error);
      return { contributions: data ?? [], count: count ?? 0 };
    },

    contribution: find,

    // The RPC deduplicates retries of the same request_id; re-reading confirms who recorded it.
    async record(input: ContributionInput, actor: string) {
      const { request_id, ...values } = input;
      const { data, error } = await client.rpc("record_contribution", {
        p_id: request_id,
        p_values: {
          ...values,
          target_vertical_id: values.target_vertical_id || null,
          approved_value_note: values.approved_value_note || null,
          valuation_reference_url: values.valuation_reference_url || null,
          notes: values.notes || null,
        },
      });
      if (error) financeDatabaseError(error);
      if (!data) throw new FinanceError(503, "Contribution could not be recorded.");
      const saved = await find(data);
      if (!saved || saved.recorded_by !== actor)
        throw new FinanceError(503, "Reload the contribution list to verify this submission before retrying.");
      return saved;
    },
  };
}
export type ContributionRepository = ReturnType<typeof createContributionRepository>;
