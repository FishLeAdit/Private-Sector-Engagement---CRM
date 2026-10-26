import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { OPPORTUNITY_PAGE_SIZE } from "./schemas";
import { OpportunityError, type OpportunityRepository } from "./types";

const selection = "*,contact:contact_id(id,name,kind,email,phone,website),primary_contact:primary_contact_id(id,name,kind,email,phone,website),secondary_contact:secondary_contact_id(id,name,kind,email,phone,website),owner:owner_id(id,display_name),stage:stage_id(*),category:contribution_category_id(*)" as const;
function databaseError(error: { code?: string }): never {
  if (error.code === "42501") throw new OpportunityError(403, "You do not have permission to change this record.");
  if (error.code === "23505") throw new OpportunityError(409, "That name, code or stage position is already in use. Refresh the configuration and choose another value.");
  if (["23514", "23503", "23001"].includes(error.code ?? "")) throw new OpportunityError(422, "These changes conflict with a linked record or an inactive selection. Check the contacts and configuration. Currency and contribution type must match existing recognized contributions.");
  if (["22P02", "22003", "22007", "22008"].includes(error.code ?? "")) throw new OpportunityError(422, "Some values are invalid. Review the form.");
  throw new OpportunityError(503, "Opportunities are temporarily unavailable. Please try again.");
}
export function createOpportunityRepository(client: SupabaseClient<Database>): OpportunityRepository {
  return {
    async list(input) {
      let query = client.from("opportunities").select(selection, { count: "exact" });
      // A single SDK filter avoids raw boolean syntax for the name search.
      if (input.q) query = query.ilike("deal_name", `%${input.q.replace(/[\\%_]/g, character => `\\${character}`)}%`);
      for (const field of ["stage_id", "owner_id", "contribution_category_id", "contribution_type", "currency"] as const) if (input[field]) query = query.eq(field, input[field]);
      if (input.contact_id) query = query.or(`contact_id.eq.${input.contact_id},primary_contact_id.eq.${input.contact_id},secondary_contact_id.eq.${input.contact_id}`);
      if (input.from) query = query.gte("expected_close_at", input.from);
      if (input.to) query = query.lte("expected_close_at", input.to);
      const start = (input.page - 1) * OPPORTUNITY_PAGE_SIZE;
      const { data, count, error } = await query.order("created_at", { ascending: false }).order("id").range(start, start + OPPORTUNITY_PAGE_SIZE - 1);
      if (error) databaseError(error);
      return { opportunities: data ?? [], count: count ?? 0 };
    },
    async find(id) {
      const { data, error } = await client.from("opportunities").select(selection).eq("id", id).maybeSingle();
      if (error) databaseError(error);
      return data;
    },
    async contact(id) {
      const { data, error } = await client.from("contacts").select("id,name,kind,email,phone,website").eq("id", id).maybeSingle();
      if (error) databaseError(error);
      return data;
    },
    async options() {
      const [stages, categories, owners] = await Promise.all([
        client.from("pipeline_stages").select("*").order("position").limit(1000),
        client.from("contribution_categories").select("*").order("name").limit(1000),
        client.from("profiles").select("id,display_name,active").eq("department", "PSE").in("role", ["pse_member", "pse_manager", "admin"]).order("display_name").limit(1000),
      ]);
      for (const result of [stages, categories, owners]) if (result.error) databaseError(result.error);
      return { stages: stages.data ?? [], categories: categories.data ?? [], owners: owners.data ?? [] };
    },
    async create(input, actor) {
      const { data, error } = await client.from("opportunities").insert({ ...input, created_by: actor }).select(selection).single();
      if (error) databaseError(error);
      if (!data) throw new OpportunityError(503, "Opportunity could not be saved.");
      return data;
    },
    async update(id, input) {
      const { data, error } = await client.from("opportunities").update(input).eq("id", id).select(selection).maybeSingle();
      if (error) databaseError(error);
      return data;
    },
    async history(id) {
      const [contributions, audits] = await Promise.all([
        client.from("recognized_contributions").select("id,amount,currency,recognized_at,contribution_type,notes").eq("opportunity_id", id).order("recognized_at", { ascending: false }).order("id").limit(10),
        client.from("audit_logs").select("id,action,before,after,created_at,actor:actor_id(display_name)").eq("entity", "opportunities").eq("entity_id", id).order("created_at", { ascending: false }).order("id").limit(20),
      ]);
      for (const result of [contributions, audits]) if (result.error) databaseError(result.error);
      return { contributions: contributions.data ?? [], audits: audits.data ?? [] };
    },
    async saveStage(input, id) {
      const query = id ? client.from("pipeline_stages").update(input).eq("id", id) : client.from("pipeline_stages").insert(input);
      const { data, error } = await query.select("id").maybeSingle();
      if (error) databaseError(error);
      if (!data) throw new OpportunityError(404, "Stage not found or your access has changed.");
    },
    async saveCategory(input, id) {
      const query = id ? client.from("contribution_categories").update(input).eq("id", id) : client.from("contribution_categories").insert(input);
      const { data, error } = await query.select("id").maybeSingle();
      if (error) databaseError(error);
      if (!data) throw new OpportunityError(404, "Category not found or your access has changed.");
    },
  };
}
