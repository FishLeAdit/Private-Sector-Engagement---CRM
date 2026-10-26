import { z } from "zod";

export function normalizeEmail(value: string | null | undefined) { return value?.trim().toLowerCase() || null; }
export function normalizePhone(value: string | null | undefined) { return value?.replace(/[^0-9]/g, "") || null; }

const httpUrl = /^https?:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?([/?#][^\s<>"]*)?$/i;
const optionalText = (max: number) => z.string().trim().max(max);
const rawFields = z.object({
  kind: z.enum(["individual", "company"]),
  name: z.string().trim().min(1, "Enter a contact name.").max(200),
  email: optionalText(254).refine(value => !value || z.email().safeParse(value).success, "Enter a valid email address."),
  phone: optionalText(64).refine(value => !value || (/^[+0-9()\s.-]+$/.test(value) && !!normalizePhone(value)), "Use digits and standard phone formatting, including the country code."),
  company_id: z.union([z.uuid(), z.literal("")]),
  designation: optionalText(200),
  website: optionalText(2048).refine(value => !value || httpUrl.test(value), "Enter a valid HTTP(S) website URL."),
  industry: optionalText(200),
  notes: optionalText(10000),
}).strict();

export const contactFields = rawFields.extend({
  email: rawFields.shape.email.default(""), phone: rawFields.shape.phone.default(""),
  company_id: rawFields.shape.company_id.default(""), designation: rawFields.shape.designation.default(""),
  website: rawFields.shape.website.default(""), industry: rawFields.shape.industry.default(""), notes: rawFields.shape.notes.default(""),
});

export const contactSchema = contactFields.superRefine((data, ctx) => {
  if (!normalizeEmail(data.email) && !normalizePhone(data.phone)) {
    ctx.addIssue({ code: "custom", path: ["email"], message: "Provide an email address or phone number." });
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Provide an email address or phone number." });
  }
  if (data.kind === "company" && data.company_id) {
    ctx.addIssue({ code: "custom", path: ["company_id"], message: "A company cannot be associated with another company." });
  }
});

export const contactPatchSchema = rawFields.partial().strict();
export type ContactFormInput = z.input<typeof contactSchema>;
export type ContactInput = z.output<typeof contactSchema>;
export const emptyContact: ContactInput = { kind: "individual", name: "", email: "", phone: "", company_id: "", designation: "", website: "", industry: "", notes: "" };

export const contactListSchema = z.object({
  q: z.string().trim().max(100).refine(value => !value.includes("*"), "Search for text without wildcard characters.").default(""),
  kind: z.enum(["all", "individual", "company"]).default("all"),
  company_id: z.union([z.uuid(), z.literal("")]).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
}).strict();
export type ContactListInput = z.output<typeof contactListSchema>;
export const CONTACT_PAGE_SIZE = 20;

export const duplicateCheckSchema = z.object({
  email: contactFields.shape.email,
  phone: contactFields.shape.phone,
  exclude: z.uuid().optional(),
}).strict();
