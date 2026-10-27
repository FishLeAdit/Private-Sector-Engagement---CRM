import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { CONTACT_PAGE_SIZE, type ContactListInput } from "./schemas";
import { ContactError, type ContactRepository } from "./types";

const selection = "*,company:company_id(id,name),creator:created_by(id,display_name)" as const;

// PostgREST .or() uses raw syntax. Quote values, escape quotes/backslashes and
// SQL LIKE wildcards; never concatenate unquoted input into a filter expression.
export function quotedContains(value: string) {
  const literal = value.replace(/[\\%_]/g, character => `\\${character}`);
  return JSON.stringify(`%${literal}%`);
}

function databaseError(error: { code?: string; message?: string }): never {
  if (error.code === "23505") {
    const field = error.message?.includes("contacts_email_unique")
      ? "email"
      : error.message?.includes("contacts_phone_unique")
        ? "phone"
        : null;
    throw new ContactError(
      409,
      "A contact with that email or phone already exists.",
      field ? { [field]: ["Already used by another contact."] } : {},
    );
  }
  if (error.code === "42501") throw new ContactError(403, "You do not have permission to change this contact.");
  if (["23514", "23503", "22P02"].includes(error.code ?? ""))
    throw new ContactError(
      422,
      "Some contact details are invalid or no longer available. Review the form and try again.",
    );
  throw new ContactError(503, "Contacts are temporarily unavailable. Please try again.");
}

export function createContactRepository(client: SupabaseClient<Database>): ContactRepository {
  return {
    async list(input: ContactListInput) {
      let query = client.from("contacts").select(selection, { count: "exact" });
      if (input.kind !== "all") query = query.eq("kind", input.kind);
      if (input.company_id) query = query.eq("company_id", input.company_id);
      if (input.q) {
        const pattern = quotedContains(input.q);
        const filters = ["name", "email_normalized", "phone", "industry", "designation"].map(
          field => `${field}.ilike.${pattern}`,
        );
        const digits = input.q.replace(/[^0-9]/g, "");
        if (digits && /^[+0-9()\s.-]+$/.test(input.q)) filters.push(`phone_normalized.ilike.${quotedContains(digits)}`);
        query = query.or(filters.join(","));
      }
      const start = (input.page - 1) * CONTACT_PAGE_SIZE;
      const { data, count, error } = await query
        .order("name")
        .order("id")
        .range(start, start + CONTACT_PAGE_SIZE - 1);
      if (error) databaseError(error);
      return { contacts: data ?? [], count: count ?? 0 };
    },
    async find(id) {
      const { data, error } = await client.from("contacts").select(selection).eq("id", id).maybeSingle();
      if (error) databaseError(error);
      return data;
    },
    async duplicates(email, phone, exclude) {
      const filters = [];
      if (email) filters.push(`email_normalized.eq.${JSON.stringify(email)}`);
      if (phone) filters.push(`phone_normalized.eq.${JSON.stringify(phone)}`);
      if (!filters.length) return [];
      let query = client.from("contacts").select("id,name,email_normalized,phone_normalized").or(filters.join(","));
      if (exclude) query = query.neq("id", exclude);
      const { data, error } = await query.limit(5);
      if (error) databaseError(error);
      return data ?? [];
    },
    async create(input, actorId) {
      const { data, error } = await client
        .from("contacts")
        .insert({ ...input, created_by: actorId })
        .select(selection)
        .single();
      if (error) databaseError(error);
      if (!data) throw new ContactError(503, "Contact could not be saved. Please try again.");
      return data;
    },
    async update(id, input) {
      const { data, error } = await client.from("contacts").update(input).eq("id", id).select(selection).maybeSingle();
      if (error) databaseError(error);
      return data;
    },
    async remove(id) {
      const { data, error } = await client.from("contacts").delete().eq("id", id).select("id").maybeSingle();
      if (error && ["23503", "23001"].includes(error.code)) {
        throw new ContactError(
          409,
          "This contact is linked to other contacts, opportunities, meetings or activities. Reassign or unlink those records before deleting it.",
        );
      }
      if (error) databaseError(error);
      return data?.id === id;
    },
    async history(id) {
      const opportunities = await client
        .from("opportunities")
        .select("id,deal_name,expected_amount,currency,created_at")
        .or(`contact_id.eq.${id},primary_contact_id.eq.${id},secondary_contact_id.eq.${id}`)
        .order("created_at", { ascending: false })
        .limit(10);
      if (opportunities.error) databaseError(opportunities.error);
      const opportunityIds = (opportunities.data ?? []).map(row => row.id);
      const opportunityFilter = opportunityIds.length ? `,opportunity_id.in.(${opportunityIds.join(",")})` : "";
      const meetings = await client
        .from("meetings")
        .select("id,title,scheduled_at,status")
        .or(`contact_id.eq.${id}${opportunityFilter}`)
        .order("scheduled_at", { ascending: false })
        .limit(10);
      if (meetings.error) databaseError(meetings.error);
      const meetingIds = (meetings.data ?? []).map(row => row.id);
      const meetingFilter = meetingIds.length ? `,meeting_id.in.(${meetingIds.join(",")})` : "";
      const activities = await client
        .from("activities")
        .select("id,activity_type,status,occurred_at,notes,created_at")
        .or(`contact_id.eq.${id}${opportunityFilter}${meetingFilter}`)
        .order("created_at", { ascending: false })
        .limit(20);
      if (activities.error) databaseError(activities.error);
      return {
        opportunities: opportunities.data ?? [],
        meetings: meetings.data ?? [],
        activities: activities.data ?? [],
      };
    },
  };
}
