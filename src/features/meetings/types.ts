import type { Tables, TablesInsert } from "@/types/database.types";
import type { MeetingListInput } from "./schemas";

export type MeetingContact = Pick<
  Tables<"contacts">,
  "id" | "name" | "kind" | "email" | "phone" | "website" | "designation" | "company_id"
> & {
  company: { id: string; name: string } | null;
};
export type MeetingOpportunity = Pick<
  Tables<"opportunities">,
  "id" | "deal_name" | "contact_id" | "primary_contact_id" | "secondary_contact_id"
> & {
  contact: MeetingContact | null;
  primary_contact: MeetingContact | null;
  secondary_contact: MeetingContact | null;
};
export type MeetingOwner = Pick<Tables<"profiles">, "id" | "display_name" | "active">;
export type MeetingOptions = {
  owners: MeetingOwner[];
  contact: MeetingContact | null;
  opportunity: MeetingOpportunity | null;
};
export type MeetingRecord = Tables<"meetings"> & {
  contact: MeetingContact | null;
  opportunity: MeetingOpportunity | null;
  owner: Pick<MeetingOwner, "id" | "display_name"> | null;
  creator: Pick<MeetingOwner, "id" | "display_name"> | null;
};
export type MeetingWrite = Pick<
  TablesInsert<"meetings">,
  "title" | "contact_id" | "opportunity_id" | "scheduled_at" | "status" | "description" | "owner_id"
>;
export type FollowUpWrite = Pick<
  TablesInsert<"activities">,
  | "activity_type"
  | "work_category"
  | "status"
  | "owner_id"
  | "meeting_id"
  | "contact_id"
  | "opportunity_id"
  | "notes"
  | "occurred_at"
>;
export type MeetingHistory = {
  activities: (Pick<
    Tables<"activities">,
    "id" | "activity_type" | "status" | "owner_id" | "remaining_work" | "occurred_at" | "notes" | "created_at"
  > & { owner: { id: string; display_name: string } | null })[];
  audits: (Pick<Tables<"audit_logs">, "id" | "action" | "before" | "after" | "created_at"> & {
    actor: { display_name: string } | null;
  })[];
};
export interface MeetingRepository {
  list(input: MeetingListInput, now: string): Promise<{ meetings: MeetingRecord[]; count: number }>;
  find(id: string): Promise<MeetingRecord | null>;
  contact(id: string): Promise<MeetingContact | null>;
  opportunity(id: string): Promise<MeetingOpportunity | null>;
  owners(): Promise<MeetingOwner[]>;
  create(input: MeetingWrite, actorId: string): Promise<MeetingRecord>;
  update(id: string, input: MeetingWrite): Promise<MeetingRecord | null>;
  remove(id: string): Promise<boolean>;
  history(id: string): Promise<MeetingHistory>;
  createFollowUp(input: FollowUpWrite, actorId: string): Promise<Tables<"activities">>;
}
export class MeetingError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "MeetingError";
  }
}
