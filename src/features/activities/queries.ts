import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { fromDhakaDateTimeInput } from "@/lib/dates";
import { quotedContains } from "@/features/contacts/queries";
import { ACTIVITY_PAGE_SIZE } from "./schemas";
import { ActivityError, type ActivityRepository } from "./types";
const contactSelection = "id,name,kind,email,phone,website,designation,company_id,company:company_id(id,name)" as const;
const opportunitySelection = `id,deal_name,contact_id,primary_contact_id,secondary_contact_id,contact:contact_id(${contactSelection}),primary_contact:primary_contact_id(${contactSelection}),secondary_contact:secondary_contact_id(${contactSelection})` as const;
const meetingSelection = `id,title,contact_id,opportunity_id,scheduled_at,status,contact:contact_id(${contactSelection}),opportunity:opportunity_id(${opportunitySelection})` as const;
const selection = `*,contact:contact_id(${contactSelection}),opportunity:opportunity_id(${opportunitySelection}),meeting:meeting_id(${meetingSelection}),owner:owner_id(id,display_name),creator:created_by(id,display_name)` as const;
function databaseError(error: { code?: string }): never {
  if (error.code === "42501") throw new ActivityError(403, "You do not have permission to change this activity.");
  if (["23514", "23503", "23001", "22P02", "22007", "22008"].includes(error.code ?? "")) throw new ActivityError(422, "These activity details conflict with a linked record or inactive owner. Review the selected records and try again.");
  throw new ActivityError(503, "Activities are temporarily unavailable. Please try again.");
}
function boundary(day: string, next = false) {
  const date = new Date(`${day}T00:00:00Z`); if (next) date.setUTCDate(date.getUTCDate() + 1);
  const value = fromDhakaDateTimeInput(`${date.toISOString().slice(0, 10)}T00:00`); if (!value) throw new ActivityError(422, "Choose valid activity dates in Asia/Dhaka."); return value;
}
export function createActivityRepository(client: SupabaseClient<Database>): ActivityRepository {
  return {
    async list(input) {
      let query = client.from("activities").select(selection, { count: "exact" });
      if (input.q) query = query.or(["notes", "remaining_work", "related_person_name", "related_organization_name"].map(field => `${field}.ilike.${quotedContains(input.q)}`).join(","));
      for (const field of ["activity_type", "work_category", "status"] as const) if (input[field] !== "all") query = query.eq(field, input[field]);
      for (const field of ["owner_id", "contact_id", "opportunity_id", "meeting_id"] as const) if (input[field]) query = query.eq(field, input[field]);
      if (input.from) query = query.gte("occurred_at", boundary(input.from)); if (input.to) query = query.lt("occurred_at", boundary(input.to, true));
      const start = (input.page - 1) * ACTIVITY_PAGE_SIZE;
      const { data, count, error } = await query.order("created_at", { ascending: false }).order("id").range(start, start + ACTIVITY_PAGE_SIZE - 1);
      if (error) databaseError(error); return { activities: data ?? [], count: count ?? 0 };
    },
    async find(id) { const { data, error } = await client.from("activities").select(selection).eq("id", id).maybeSingle(); if (error) databaseError(error); return data; },
    async contact(id) { const { data, error } = await client.from("contacts").select(contactSelection).eq("id", id).maybeSingle(); if (error) databaseError(error); return data; },
    async opportunity(id) { const { data, error } = await client.from("opportunities").select(opportunitySelection).eq("id", id).maybeSingle(); if (error) databaseError(error); return data; },
    async meeting(id) { const { data, error } = await client.from("meetings").select(meetingSelection).eq("id", id).maybeSingle(); if (error) databaseError(error); return data; },
    async owners() { const { data, error } = await client.from("profiles").select("id,display_name,active").eq("department", "PSE").in("role", ["pse_member", "pse_manager", "admin"]).order("display_name").order("id").limit(1000); if (error) databaseError(error); return data ?? []; },
    async create(input, actor) { const { data, error } = await client.from("activities").insert({ ...input, created_by: actor }).select(selection).single(); if (error) databaseError(error); if (!data) throw new ActivityError(503, "Activity could not be saved."); return data; },
    async update(id, input) { const { data, error } = await client.from("activities").update(input).eq("id", id).select(selection).maybeSingle(); if (error) databaseError(error); return data; },
    async remove(id) {
      const { data, error } = await client.from("activities").delete().eq("id", id).select("id").maybeSingle();
      if (error && ["23503", "23001"].includes(error.code)) throw new ActivityError(409, "This activity is referenced by other records and cannot be deleted."); if (error) databaseError(error); return data?.id === id;
    },
    async history(id) { const { data, error } = await client.from("audit_logs").select("id,action,before,after,created_at,actor:actor_id(display_name)").eq("entity", "activities").eq("entity_id", id).order("created_at", { ascending: false }).order("id").limit(20); if (error) databaseError(error); return data ?? []; },
  };
}
