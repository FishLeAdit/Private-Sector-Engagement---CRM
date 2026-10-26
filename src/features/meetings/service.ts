import "server-only";
import { z } from "zod";
import type { AccessResult } from "@/lib/auth/session";
import { isActivePseProfile, isPseManager } from "@/lib/auth/roles";
import { followUpSchema, meetingListSchema, meetingOptionsSchema, meetingPatchSchema, meetingSchema, type MeetingInput } from "./schemas";
import { MeetingError, type MeetingRecord, type MeetingRepository, type MeetingWrite } from "./types";

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const fields: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) (fields[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
  throw new MeetingError(422, "Review the meeting details.", fields);
}
function validId(id: string) {
  if (!z.uuid().safeParse(id).success) throw new MeetingError(400, "Invalid meeting ID.");
  return id;
}
export function canEditMeeting(access: AccessResult, meeting: Pick<MeetingRecord, "owner_id" | "created_by">) {
  return access.status === "allowed" && isActivePseProfile(access.profile) && access.userId === access.profile.id
    && (meeting.owner_id === access.userId || meeting.created_by === access.userId || isPseManager(access.profile));
}
export function meetingValues(meeting: MeetingRecord): MeetingInput {
  return { title: meeting.title, contact_id: meeting.contact_id ?? "", opportunity_id: meeting.opportunity_id ?? "", scheduled_at: meeting.scheduled_at,
    status: meeting.status as MeetingInput["status"], description: meeting.description ?? "", owner_id: meeting.owner_id };
}
function writeValues(input: MeetingInput): MeetingWrite {
  return { ...input, contact_id: input.contact_id || null, opportunity_id: input.opportunity_id || null, description: input.description || null };
}
export function createMeetingsService(repository: MeetingRepository, access: AccessResult) {
  function authorize() {
    if (access.status !== "allowed" || !isActivePseProfile(access.profile) || access.userId !== access.profile.id) throw new MeetingError(access.status === "anonymous" ? 401 : access.status === "unavailable" ? 503 : 403, "PSE access is required.");
    return access;
  }
  async function requireMeeting(id: string) {
    const meeting = await repository.find(validId(id));
    if (!meeting) throw new MeetingError(404, "Meeting not found.");
    return meeting;
  }
  async function validateOwner(ownerId: string, currentOwner?: string) {
    const actor = authorize();
    if (ownerId !== (currentOwner ?? actor.userId) && !isPseManager(actor.profile)) throw new MeetingError(403, "Only an authorized manager may assign another owner.");
    if (ownerId !== currentOwner && !(await repository.owners()).some(owner => owner.id === ownerId && owner.active)) throw new MeetingError(422, "Choose an active PSE owner.", { owner_id: ["Choose an active PSE owner."] });
  }
  async function validate(input: MeetingInput, current?: MeetingRecord) {
    await validateOwner(input.owner_id, current?.owner_id);
    if (input.contact_id && !await repository.contact(input.contact_id)) throw new MeetingError(422, "Choose an existing contact.", { contact_id: ["This contact is no longer available."] });
    if (input.opportunity_id) {
      const opportunity = await repository.opportunity(input.opportunity_id);
      if (!opportunity) throw new MeetingError(422, "Choose an existing opportunity.", { opportunity_id: ["This opportunity is no longer available."] });
      if (input.contact_id && ![opportunity.contact_id, opportunity.primary_contact_id, opportunity.secondary_contact_id].includes(input.contact_id)) throw new MeetingError(422, "Choose the opportunity's party or a designated primary/secondary contact.", { contact_id: ["This contact does not belong to the selected opportunity."] });
    }
  }
  return {
    async list(input: unknown) { authorize(); return repository.list(parse(meetingListSchema, input), new Date().toISOString()); },
    async get(id: string) { authorize(); return requireMeeting(id); },
    async details(id: string) { authorize(); const meeting = await requireMeeting(id); return { meeting, history: await repository.history(meeting.id) }; },
    async options(input: unknown = {}) {
      authorize(); const value = parse(meetingOptionsSchema, input);
      const [owners, contact, opportunity] = await Promise.all([repository.owners(), value.contact_id ? repository.contact(value.contact_id) : null, value.opportunity_id ? repository.opportunity(value.opportunity_id) : null]);
      if (value.contact_id && !contact) throw new MeetingError(422, "The selected contact is no longer available.", { contact_id: ["Choose an existing contact."] });
      if (value.opportunity_id && !opportunity) throw new MeetingError(422, "The selected opportunity is no longer available.", { opportunity_id: ["Choose an existing opportunity."] });
      return { owners, contact, opportunity };
    },
    async create(input: unknown) {
      const actor = authorize(); const data = parse(meetingSchema, input); await validate(data);
      return repository.create(writeValues(data), actor.userId);
    },
    async update(id: string, input: unknown) {
      authorize(); const current = await requireMeeting(id);
      if (!canEditMeeting(access, current)) throw new MeetingError(403, "Only the owner, creator or an authorized manager may edit this meeting.");
      const patch = parse(meetingPatchSchema, input), data = parse(meetingSchema, { ...meetingValues(current), ...patch });
      await validate(data, current);
      const saved = await repository.update(id, writeValues(data));
      if (!saved) throw new MeetingError(403, "This meeting could not be updated. Refresh to check your access.");
      return saved;
    },
    async remove(id: string) {
      authorize(); const meeting = await requireMeeting(id);
      if (!canEditMeeting(access, meeting)) throw new MeetingError(403, "Only the owner, creator or an authorized manager may delete this meeting.");
      if (!await repository.remove(meeting.id)) throw new MeetingError(403, "This meeting could not be deleted. Refresh to check your access.");
      return { deleted: true, id: meeting.id };
    },
    async createFollowUp(id: string, input: unknown) {
      const actor = authorize(), meeting = await requireMeeting(id), data = parse(followUpSchema, input);
      const ownerId = data.owner_id || actor.userId; await validateOwner(ownerId);
      return repository.createFollowUp({ activity_type: "task", work_category: "independent_general", status: "open", owner_id: ownerId,
        meeting_id: meeting.id, contact_id: meeting.contact_id, opportunity_id: meeting.opportunity_id, notes: data.notes, occurred_at: data.occurred_at || null }, actor.userId);
    },
  };
}
