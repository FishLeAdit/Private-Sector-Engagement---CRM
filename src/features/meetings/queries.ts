import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { fromDhakaDateTimeInput } from "@/lib/dates";
import { MEETING_PAGE_SIZE } from "./schemas";
import { MeetingError, type MeetingRepository } from "./types";

const contactSelection = "id,name,kind,email,phone,website,designation,company_id,company:company_id(id,name)" as const;
const opportunitySelection = `id,deal_name,contact_id,primary_contact_id,secondary_contact_id,contact:contact_id(${contactSelection}),primary_contact:primary_contact_id(${contactSelection}),secondary_contact:secondary_contact_id(${contactSelection})` as const;
const selection = `*,contact:contact_id(${contactSelection}),opportunity:opportunity_id(${opportunitySelection}),owner:owner_id(id,display_name),creator:created_by(id,display_name)` as const;
function databaseError(error: { code?: string }): never {
  if (error.code === "42501") throw new MeetingError(403, "You do not have permission to change this record.");
  if (["23514", "23503", "23001"].includes(error.code ?? "")) throw new MeetingError(422, "These meeting details conflict with a linked record. Check the contact, opportunity and active owner. Existing activity relationships must remain compatible.");
  if (["22P02", "22003", "22007", "22008"].includes(error.code ?? "")) throw new MeetingError(422, "Some meeting values are invalid. Review the form.");
  throw new MeetingError(503, "Meetings are temporarily unavailable. Please try again.");
}
function dhakaMidnight(day: string, nextDay = false) {
  const calendar = new Date(`${day}T00:00:00Z`);
  if (nextDay) calendar.setUTCDate(calendar.getUTCDate() + 1);
  const instant = fromDhakaDateTimeInput(`${calendar.toISOString().slice(0, 10)}T00:00`);
  if (!instant) throw new MeetingError(422, "Choose valid meeting dates in Asia/Dhaka.");
  return instant;
}

export function createMeetingRepository(client: SupabaseClient<Database>): MeetingRepository {
  return {
    async list(input, now) {
      let query = client.from("meetings").select(selection, { count: "exact" });
      if (input.q) query = query.ilike("title", `%${input.q.replace(/[\\%_]/g, character => `\\${character}`)}%`);
      if (input.status !== "all") query = query.eq("status", input.status);
      if (input.period === "upcoming") query = query.eq("status", "scheduled").gte("scheduled_at", now);
      if (input.period === "completed") query = query.eq("status", "done");
      for (const field of ["owner_id", "contact_id", "opportunity_id"] as const) if (input[field]) query = query.eq(field, input[field]);
      if (input.from) query = query.gte("scheduled_at", dhakaMidnight(input.from));
      if (input.to) query = query.lt("scheduled_at", dhakaMidnight(input.to, true));
      const start = (input.page - 1) * MEETING_PAGE_SIZE;
      const { data, count, error } = await query.order("scheduled_at").order("id").range(start, start + MEETING_PAGE_SIZE - 1);
      if (error) databaseError(error);
      return { meetings: data ?? [], count: count ?? 0 };
    },
    async find(id) {
      const { data, error } = await client.from("meetings").select(selection).eq("id", id).maybeSingle();
      if (error) databaseError(error);
      return data;
    },
    async contact(id) {
      const { data, error } = await client.from("contacts").select(contactSelection).eq("id", id).maybeSingle();
      if (error) databaseError(error);
      return data;
    },
    async opportunity(id) {
      const { data, error } = await client.from("opportunities").select(opportunitySelection).eq("id", id).maybeSingle();
      if (error) databaseError(error);
      return data;
    },
    async owners() {
      const { data, error } = await client.from("profiles").select("id,display_name,active").eq("department", "PSE").in("role", ["pse_member", "pse_manager", "admin"]).order("display_name").order("id").limit(1000);
      if (error) databaseError(error);
      return data ?? [];
    },
    async create(input, actorId) {
      const { data, error } = await client.from("meetings").insert({ ...input, created_by: actorId }).select(selection).single();
      if (error) databaseError(error);
      if (!data) throw new MeetingError(503, "Meeting could not be saved.");
      return data;
    },
    async update(id, input) {
      const { data, error } = await client.from("meetings").update(input).eq("id", id).select(selection).maybeSingle();
      if (error) databaseError(error);
      return data;
    },
    async remove(id) {
      const { data, error } = await client.from("meetings").delete().eq("id", id).select("id").maybeSingle();
      if (error && ["23503", "23001"].includes(error.code)) throw new MeetingError(409, "This meeting has linked activities or follow-up tasks and cannot be deleted. Reassign or unlink that work first; it will not be deleted automatically.");
      if (error) databaseError(error);
      return data?.id === id;
    },
    async history(id) {
      const [activities, audits] = await Promise.all([
        client.from("activities").select("id,activity_type,status,owner_id,remaining_work,occurred_at,notes,created_at,owner:owner_id(id,display_name)").eq("meeting_id", id).order("created_at", { ascending: false }).order("id").limit(20),
        client.from("audit_logs").select("id,action,before,after,created_at,actor:actor_id(display_name)").eq("entity", "meetings").eq("entity_id", id).order("created_at", { ascending: false }).order("id").limit(20),
      ]);
      for (const result of [activities, audits]) if (result.error) databaseError(result.error);
      return { activities: activities.data ?? [], audits: audits.data ?? [] };
    },
    async createFollowUp(input, actorId) {
      const { data, error } = await client.from("activities").insert({ ...input, created_by: actorId }).select("*").single();
      if (error) databaseError(error);
      if (!data) throw new MeetingError(503, "Follow-up task could not be saved.");
      return data;
    },
  };
}
