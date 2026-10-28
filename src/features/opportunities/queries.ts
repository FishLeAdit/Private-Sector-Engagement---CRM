import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { isPastLastPage } from "@/lib/supabase/pagination";
import { OPPORTUNITY_PAGE_SIZE } from "./schemas";
import { OpportunityError, type OpportunityFilters, type OpportunityRepository } from "./types";

const selection =
  "*,contact:contact_id(id,name,kind,email,phone,website),primary_contact:primary_contact_id(id,name,kind,email,phone,website),secondary_contact:secondary_contact_id(id,name,kind,email,phone,website),owner:owner_id(id,display_name),stage:stage_id(*),category:contribution_category_id(*)" as const;
function databaseError(error: { code?: string }): never {
  if (error.code === "42501") throw new OpportunityError(403, "You do not have permission to change this record.");
  if (error.code === "23505")
    throw new OpportunityError(
      409,
      "That name, code or stage position is already in use. Refresh the configuration and choose another value.",
    );
  if (["23514", "23503", "23001"].includes(error.code ?? ""))
    throw new OpportunityError(
      422,
      "These changes conflict with a linked record or an inactive selection. Check the contacts and configuration. Currency and contribution type must match existing recognized contributions.",
    );
  if (["22P02", "22003", "22007", "22008"].includes(error.code ?? ""))
    throw new OpportunityError(422, "Some values are invalid. Review the form.");
  throw new OpportunityError(503, "Opportunities are temporarily unavailable. Please try again.");
}
// The query methods the list filters use; Supabase's typed builders satisfy it.
type Filterable<T> = {
  ilike(column: string, pattern: string): T;
  eq(column: string, value: string): T;
  or(filters: string): T;
  gte(column: string, value: string): T;
  lte(column: string, value: string): T;
};
// The list, the board and the pipeline summary filter deals the same way.
function filtered<T extends Filterable<T>>(query: T, input: OpportunityFilters): T {
  // A single SDK filter avoids raw boolean syntax for the name search.
  if (input.q) query = query.ilike("deal_name", `%${input.q.replace(/[\\%_]/g, character => `\\${character}`)}%`);
  for (const field of ["stage_id", "owner_id", "contribution_category_id", "contribution_type", "currency"] as const)
    if (input[field]) query = query.eq(field, input[field]);
  if (input.contact_id)
    query = query.or(
      `contact_id.eq.${input.contact_id},primary_contact_id.eq.${input.contact_id},secondary_contact_id.eq.${input.contact_id}`,
    );
  if (input.from) query = query.gte("expected_close_at", input.from);
  if (input.to) query = query.lte("expected_close_at", input.to);
  return query;
}
const SUMMARY_CHUNK = 1000; // Supabase returns at most 1,000 rows per request
export function createOpportunityRepository(client: SupabaseClient<Database>): OpportunityRepository {
  return {
    async list(input) {
      const query = filtered(client.from("opportunities").select(selection, { count: "exact" }), input);
      const start = (input.page - 1) * OPPORTUNITY_PAGE_SIZE;
      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .order("id")
        .range(start, start + OPPORTUNITY_PAGE_SIZE - 1);
      if (isPastLastPage(error) && input.page > 1)
        return { opportunities: [], count: (await this.list({ ...input, page: 1 })).count };
      if (error) databaseError(error);
      return { opportunities: data ?? [], count: count ?? 0 };
    },
    // Three columns of every matching deal, read in 1,000-row chunks, so board and list totals are not
    // limited to one page.
    async summary(input) {
      const rows: { stage_id: string; currency: string; expected_amount: number }[] = [];
      for (let start = 0; ; start += SUMMARY_CHUNK) {
        const { data, error } = await filtered(
          client.from("opportunities").select("stage_id,currency,expected_amount"),
          input,
        )
          .order("id")
          .range(start, start + SUMMARY_CHUNK - 1);
        if (error) databaseError(error);
        rows.push(...(data ?? []));
        if ((data?.length ?? 0) < SUMMARY_CHUNK) return rows;
      }
    },
    async stageCards(input, stageId, limit) {
      const { data, error } = await filtered(client.from("opportunities").select(selection), input)
        .eq("stage_id", stageId)
        .order("created_at", { ascending: false })
        .order("id")
        .range(0, limit - 1);
      if (error) databaseError(error);
      return data ?? [];
    },
    async find(id) {
      const { data, error } = await client.from("opportunities").select(selection).eq("id", id).maybeSingle();
      if (error) databaseError(error);
      return data;
    },
    async contact(id) {
      const { data, error } = await client
        .from("contacts")
        .select("id,name,kind,email,phone,website")
        .eq("id", id)
        .maybeSingle();
      if (error) databaseError(error);
      return data;
    },
    async options() {
      const [stages, categories, owners] = await Promise.all([
        client.from("pipeline_stages").select("*").order("position").limit(1000),
        client.from("contribution_categories").select("*").order("name").limit(1000),
        client
          .from("profiles")
          .select("id,display_name,active")
          .eq("department", "PSE")
          .in("role", ["pse_member", "pse_manager", "admin"])
          .order("display_name")
          .limit(1000),
      ]);
      for (const result of [stages, categories, owners]) if (result.error) databaseError(result.error);
      return { stages: stages.data ?? [], categories: categories.data ?? [], owners: owners.data ?? [] };
    },
    async create(input, actor) {
      const { data, error } = await client
        .from("opportunities")
        .insert({ ...input, created_by: actor })
        .select(selection)
        .single();
      if (error) databaseError(error);
      if (!data) throw new OpportunityError(503, "Opportunity could not be saved.");
      return data;
    },
    async update(id, input) {
      const { data, error } = await client
        .from("opportunities")
        .update(input)
        .eq("id", id)
        .select(selection)
        .maybeSingle();
      if (error) databaseError(error);
      return data;
    },
    async remove(id) {
      const { data, error } = await client.from("opportunities").delete().eq("id", id).select("id").maybeSingle();
      if (error && ["23503", "23001"].includes(error.code))
        throw new OpportunityError(
          409,
          "This opportunity has linked meetings, activities or recognized contributions and cannot be deleted. Related work must be reassigned or unlinked, and recognized contribution history must be retained.",
        );
      if (error) databaseError(error);
      return data?.id === id;
    },
    async history(id) {
      const [contributions, audits] = await Promise.all([
        client
          .from("recognized_contributions")
          .select("id,amount,currency,recognized_at,contribution_type,notes,corrects_contribution_id,correction_reason")
          .eq("opportunity_id", id)
          .order("recognized_at", { ascending: false })
          .order("id")
          .limit(10),
        client
          .from("audit_logs")
          .select("id,action,before,after,created_at,actor:actor_id(display_name)")
          .eq("entity", "opportunities")
          .eq("entity_id", id)
          .order("created_at", { ascending: false })
          .order("id")
          .limit(20),
      ]);
      for (const result of [contributions, audits]) if (result.error) databaseError(result.error);
      return { contributions: contributions.data ?? [], audits: audits.data ?? [] };
    },
    async saveStage(input, id) {
      const query = id
        ? client.from("pipeline_stages").update(input).eq("id", id)
        : client.from("pipeline_stages").insert(input);
      const { data, error } = await query.select("id").maybeSingle();
      if (error) databaseError(error);
      if (!data) throw new OpportunityError(404, "Stage not found or your access has changed.");
    },
    async saveCategory(input, id) {
      const query = id
        ? client.from("contribution_categories").update(input).eq("id", id)
        : client.from("contribution_categories").insert(input);
      const { data, error } = await query.select("id").maybeSingle();
      if (error) databaseError(error);
      if (!data) throw new OpportunityError(404, "Category not found or your access has changed.");
    },
  };
}
