import type { Tables, TablesInsert } from "@/types/database.types";
import type { MeetingContact, MeetingOpportunity, MeetingOwner } from "@/features/meetings/types";
import type { ActivityListInput } from "./schemas";
export type ActivityContact = MeetingContact;
export type ActivityOpportunity = MeetingOpportunity;
export type ActivityOwner = MeetingOwner;
export type ActivityMeeting = Pick<
  Tables<"meetings">,
  "id" | "title" | "contact_id" | "opportunity_id" | "scheduled_at" | "status"
> & { contact: ActivityContact | null; opportunity: ActivityOpportunity | null };
export type ActivityRecord = Tables<"activities"> & {
  contact: ActivityContact | null;
  opportunity: ActivityOpportunity | null;
  meeting: ActivityMeeting | null;
  owner: { id: string; display_name: string } | null;
  creator: { id: string; display_name: string } | null;
};
export type ActivityWrite = Pick<
  TablesInsert<"activities">,
  | "activity_type"
  | "work_category"
  | "status"
  | "owner_id"
  | "contact_id"
  | "opportunity_id"
  | "meeting_id"
  | "related_person_name"
  | "related_organization_name"
  | "remaining_work"
  | "occurred_at"
  | "notes"
  | "drive_urls"
>;
export type ActivityOptions = {
  owners: ActivityOwner[];
  contact: ActivityContact | null;
  opportunity: ActivityOpportunity | null;
  meeting: ActivityMeeting | null;
};
export type ActivityAudit = Pick<Tables<"audit_logs">, "id" | "action" | "before" | "after" | "created_at"> & {
  actor: { display_name: string } | null;
};
export interface ActivityRepository {
  list(input: ActivityListInput): Promise<{ activities: ActivityRecord[]; count: number }>;
  find(id: string): Promise<ActivityRecord | null>;
  contact(id: string): Promise<ActivityContact | null>;
  opportunity(id: string): Promise<ActivityOpportunity | null>;
  meeting(id: string): Promise<ActivityMeeting | null>;
  owners(): Promise<ActivityOwner[]>;
  create(input: ActivityWrite, actor: string): Promise<ActivityRecord>;
  update(id: string, input: ActivityWrite): Promise<ActivityRecord | null>;
  remove(id: string): Promise<boolean>;
  history(id: string): Promise<ActivityAudit[]>;
}
export class ActivityError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ActivityError";
  }
}
