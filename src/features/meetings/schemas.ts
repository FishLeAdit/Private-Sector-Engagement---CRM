import { z } from "zod";

export const MEETING_PAGE_SIZE = 20;
const optionalId = z.union([z.uuid(), z.literal("")]);
const text = (max: number) => z.string().trim().max(max);
const instant = z.iso
  .datetime({ offset: true })
  .refine(value => Number.isFinite(Date.parse(value)), "Enter a valid date and time with a timezone.")
  .transform(value => new Date(value).toISOString());
const raw = {
  title: text(200).min(1, "Enter a meeting title."),
  contact_id: optionalId,
  opportunity_id: optionalId,
  scheduled_at: instant,
  status: z.enum(["scheduled", "done", "cancelled"]),
  description: text(10000),
  owner_id: z.uuid("Choose a meeting owner."),
};
export const meetingSchema = z
  .object({
    ...raw,
    contact_id: raw.contact_id.default(""),
    opportunity_id: raw.opportunity_id.default(""),
    status: raw.status.default("scheduled"),
    description: raw.description.default(""),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.contact_id && !value.opportunity_id) {
      for (const field of ["contact_id", "opportunity_id"])
        ctx.addIssue({ code: "custom", path: [field], message: "Link a contact or an opportunity." });
    }
  });
// Defaults belong only to creation. A partial update preserves omitted fields.
export const meetingPatchSchema = z
  .object(raw)
  .partial()
  .strict()
  .refine(value => Object.keys(value).length > 0, "Provide at least one change.");
export type MeetingInput = z.output<typeof meetingSchema>;
export type MeetingFormInput = z.input<typeof meetingSchema>;
export const emptyMeeting: MeetingInput = {
  title: "",
  contact_id: "",
  opportunity_id: "",
  scheduled_at: "",
  status: "scheduled",
  description: "",
  owner_id: "",
};
const day = z.union([z.iso.date(), z.literal("")]);
export const meetingListSchema = z
  .object({
    q: text(100)
      .refine(value => !value.includes("*"), "Search without the * wildcard.")
      .default(""),
    status: z.enum(["all", "scheduled", "done", "cancelled"]).default("all"),
    period: z.enum(["all", "upcoming", "completed"]).default("all"),
    owner_id: optionalId.default(""),
    contact_id: optionalId.default(""),
    opportunity_id: optionalId.default(""),
    from: day.default(""),
    to: day.default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict()
  .refine(value => !value.from || !value.to || value.from <= value.to, "Meeting date range is reversed.");
export type MeetingListInput = z.output<typeof meetingListSchema>;
export const meetingOptionsSchema = z
  .object({ contact_id: optionalId.default(""), opportunity_id: optionalId.default("") })
  .strict();
export const followUpSchema = z
  .object({
    notes: text(10000).min(1, "Describe the follow-up task."),
    occurred_at: z.union([instant, z.literal("")]).default(""),
    owner_id: optionalId.default(""),
  })
  .strict();
export type FollowUpInput = z.output<typeof followUpSchema>;
