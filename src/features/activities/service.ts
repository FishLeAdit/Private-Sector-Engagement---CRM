import "server-only";
import { z } from "zod";
import type { AccessResult } from "@/lib/auth/session";
import { isActivePseProfile, isPseManager } from "@/lib/auth/roles";
import { activityListSchema, activityOptionsSchema, activityPatchSchema, activitySchema, type ActivityInput } from "./schemas";
import { ActivityError, type ActivityRecord, type ActivityRepository, type ActivityWrite } from "./types";
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input); if (result.success) return result.data;
  const fields: Record<string, string[]> = {}; for (const issue of result.error.issues) (fields[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
  throw new ActivityError(422, "Review the activity details.", fields);
}
function validId(id: string) { if (!z.uuid().safeParse(id).success) throw new ActivityError(400, "Invalid activity ID."); return id; }
export function canEditActivity(access: AccessResult, row: Pick<ActivityRecord, "owner_id" | "created_by">) {
  return access.status === "allowed" && isActivePseProfile(access.profile) && access.userId === access.profile.id && (row.owner_id === access.userId || row.created_by === access.userId || isPseManager(access.profile));
}
export function activityValues(row: ActivityRecord): ActivityInput {
  return { activity_type: row.activity_type as ActivityInput["activity_type"], work_category: row.work_category as ActivityInput["work_category"], status: row.status as ActivityInput["status"], owner_id: row.owner_id,
    contact_id: row.contact_id ?? "", opportunity_id: row.opportunity_id ?? "", meeting_id: row.meeting_id ?? "", related_person_name: row.related_person_name ?? "", related_organization_name: row.related_organization_name ?? "", remaining_work: row.remaining_work ?? "", occurred_at: row.occurred_at ?? "", notes: row.notes ?? "", drive_urls: row.drive_urls };
}
function writeValues(input: ActivityInput): ActivityWrite {
  return { ...input, contact_id: input.contact_id || null, opportunity_id: input.opportunity_id || null, meeting_id: input.meeting_id || null, related_person_name: input.related_person_name || null, related_organization_name: input.related_organization_name || null, remaining_work: input.remaining_work || null, occurred_at: input.occurred_at || null };
}
export function createActivitiesService(repository: ActivityRepository, access: AccessResult) {
  function authorize() {
    if (access.status !== "allowed" || !isActivePseProfile(access.profile) || access.userId !== access.profile.id) throw new ActivityError(access.status === "anonymous" ? 401 : access.status === "unavailable" ? 503 : 403, "PSE access is required.");
    return access;
  }
  async function requireActivity(id: string) { const row = await repository.find(validId(id)); if (!row) throw new ActivityError(404, "Activity not found."); return row; }
  async function references(input: { contact_id: string; opportunity_id: string; meeting_id: string }) {
    const [contact, opportunity, meeting] = await Promise.all([input.contact_id ? repository.contact(input.contact_id) : null, input.opportunity_id ? repository.opportunity(input.opportunity_id) : null, input.meeting_id ? repository.meeting(input.meeting_id) : null]);
    for (const [field, value] of [["contact_id", contact], ["opportunity_id", opportunity], ["meeting_id", meeting]] as const) if (input[field] && !value) throw new ActivityError(422, "A selected record is no longer available.", { [field]: ["Choose an existing record or clear this link."] });
    return { contact, opportunity, meeting };
  }
  async function validate(input: ActivityInput, current?: ActivityRecord) {
    const actor = authorize();
    if (input.owner_id !== (current?.owner_id ?? actor.userId) && !isPseManager(actor.profile)) throw new ActivityError(403, "Only an authorized manager may assign another owner.");
    if (input.owner_id !== current?.owner_id && !(await repository.owners()).some(row => row.id === input.owner_id && row.active)) throw new ActivityError(422, "Choose an active PSE owner.", { owner_id: ["Choose an active PSE owner."] });
    const { opportunity, meeting } = await references(input);
    const fail = (field: string, message: string): never => { throw new ActivityError(422, message, { [field]: [message] }); };
    if (meeting && input.opportunity_id && meeting.opportunity_id && input.opportunity_id !== meeting.opportunity_id) fail("opportunity_id", "The opportunity must match the selected meeting.");
    const effective = opportunity ?? meeting?.opportunity;
    if (effective) {
      const accepts = (id: string | null) => !id || [effective.contact_id, effective.primary_contact_id, effective.secondary_contact_id].includes(id);
      if (!accepts(input.contact_id)) fail("contact_id", "Choose the opportunity party or a designated primary/secondary contact.");
      if (meeting && !accepts(meeting.contact_id)) fail("meeting_id", "This meeting's contact does not belong to the selected opportunity.");
    } else if (meeting && input.contact_id && input.contact_id !== meeting.contact_id) fail("contact_id", "Choose the contact used by the contact-only meeting, or clear the direct contact link.");
  }
  return {
    async list(input: unknown) { authorize(); return repository.list(parse(activityListSchema, input)); },
    async get(id: string) { authorize(); return requireActivity(id); },
    async details(id: string) { authorize(); const activity = await requireActivity(id); return { activity, audits: await repository.history(activity.id) }; },
    async options(input: unknown = {}) { authorize(); const links = parse(activityOptionsSchema, input); const [owners, refs] = await Promise.all([repository.owners(), references(links)]); return { owners, ...refs }; },
    async create(input: unknown) { const actor = authorize(), data = parse(activitySchema, input); await validate(data); return repository.create(writeValues(data), actor.userId); },
    async update(id: string, input: unknown) {
      authorize(); const current = await requireActivity(id); if (!canEditActivity(access, current)) throw new ActivityError(403, "Only the owner, creator or an authorized manager may edit this activity.");
      const data = parse(activitySchema, { ...activityValues(current), ...parse(activityPatchSchema, input) }); await validate(data, current);
      const saved = await repository.update(id, writeValues(data)); if (!saved) throw new ActivityError(403, "This activity could not be updated. Refresh to check your access."); return saved;
    },
    async remove(id: string) {
      authorize(); const current = await requireActivity(id); if (!canEditActivity(access, current)) throw new ActivityError(403, "Only the owner, creator or an authorized manager may delete this activity.");
      if (!await repository.remove(current.id)) throw new ActivityError(403, "This activity could not be deleted. Refresh to check your access."); return { deleted: true, id: current.id };
    },
  };
}
