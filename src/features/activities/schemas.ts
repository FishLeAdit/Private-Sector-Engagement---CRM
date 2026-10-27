import { z } from "zod";
export const ACTIVITY_PAGE_SIZE = 20;
export const activityTypes = [
  "task",
  "email",
  "call",
  "meeting",
  "event",
  "campaign",
  "proposal",
  "visit",
  "stewardship",
  "prospect_engagement",
  "general",
] as const;
export const workCategories = ["stewardship", "prospect_engagement", "independent_general"] as const;
export const activityStatuses = ["open", "in_progress", "done", "cancelled"] as const;
export const activityTypeLabels: Record<(typeof activityTypes)[number], string> = {
  task: "Task",
  email: "Email",
  call: "Call",
  meeting: "Meeting",
  event: "Event",
  campaign: "Campaign",
  proposal: "Proposal preparation/submission",
  visit: "School / office visit",
  stewardship: "Donor servicing / stewardship",
  prospect_engagement: "Potential-donor engagement",
  general: "General / independent activity",
};
export const workCategoryLabels: Record<(typeof workCategories)[number], string> = {
  stewardship: "Stewardship",
  prospect_engagement: "Potential-donor engagement",
  independent_general: "Independent / general work",
};
export const activityStatusLabels: Record<(typeof activityStatuses)[number], string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};
const text = (max: number) => z.string().trim().max(max),
  optionalId = z.union([z.uuid(), z.literal("")]);
const instant = z.iso
  .datetime({ offset: true })
  .refine(value => Number.isFinite(Date.parse(value)), "Enter a valid date/time with timezone.")
  .transform(value => new Date(value).toISOString());
const raw = {
  activity_type: z.enum(activityTypes),
  work_category: z.enum(workCategories),
  status: z.enum(activityStatuses),
  owner_id: z.uuid("Choose an owner."),
  contact_id: optionalId,
  opportunity_id: optionalId,
  meeting_id: optionalId,
  related_person_name: text(200),
  related_organization_name: text(200),
  remaining_work: text(10000),
  occurred_at: z.union([instant, z.literal("")]),
  notes: text(10000).min(1, "Describe the activity."),
  drive_urls: z
    .array(z.string().trim())
    .transform(values => values.filter(Boolean))
    .pipe(z.array(z.url({ protocol: /^https?$/ }).max(2048)).max(20)),
};
export const activitySchema = z
  .object({
    ...raw,
    work_category: raw.work_category.default("independent_general"),
    status: raw.status.default("open"),
    contact_id: optionalId.default(""),
    opportunity_id: optionalId.default(""),
    meeting_id: optionalId.default(""),
    related_person_name: raw.related_person_name.default(""),
    related_organization_name: raw.related_organization_name.default(""),
    remaining_work: raw.remaining_work.default(""),
    occurred_at: raw.occurred_at.default(""),
    drive_urls: raw.drive_urls.default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      !value.related_person_name &&
      !value.related_organization_name &&
      !value.contact_id &&
      !value.opportunity_id &&
      !value.meeting_id
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["related_person_name"],
        message: "Add a related person or organization, or link an existing CRM record.",
      });
    }
  });
export const activityPatchSchema = z
  .object(raw)
  .partial()
  .strict()
  .refine(value => Object.keys(value).length > 0, "Provide at least one change.");
export type ActivityInput = z.output<typeof activitySchema>;
export type ActivityFormInput = z.input<typeof activitySchema>;
export const emptyActivity: ActivityInput = {
  activity_type: "task",
  work_category: "independent_general",
  status: "open",
  owner_id: "",
  contact_id: "",
  opportunity_id: "",
  meeting_id: "",
  related_person_name: "",
  related_organization_name: "",
  remaining_work: "",
  occurred_at: "",
  notes: "",
  drive_urls: [],
};
const day = z.union([z.iso.date(), z.literal("")]);
export const activityListSchema = z
  .object({
    q: text(100)
      .refine(value => !value.includes("*"), "Search without the * wildcard.")
      .default(""),
    activity_type: z.enum(["all", ...activityTypes]).default("all"),
    work_category: z.enum(["all", ...workCategories]).default("all"),
    status: z.enum(["all", ...activityStatuses]).default("all"),
    owner_id: optionalId.default(""),
    contact_id: optionalId.default(""),
    opportunity_id: optionalId.default(""),
    meeting_id: optionalId.default(""),
    from: day.default(""),
    to: day.default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict()
  .refine(value => !value.from || !value.to || value.from <= value.to, "Activity date range is reversed.");
export type ActivityListInput = z.output<typeof activityListSchema>;
export const activityOptionsSchema = z
  .object({
    contact_id: optionalId.default(""),
    opportunity_id: optionalId.default(""),
    meeting_id: optionalId.default(""),
  })
  .strict();
export function activityTitle(activity: { activity_type: string; notes: string | null }) {
  return (
    activity.notes?.trim().split(/\r?\n/)[0]?.slice(0, 100) ||
    activityTypeLabels[activity.activity_type as (typeof activityTypes)[number]] ||
    "Activity"
  );
}
