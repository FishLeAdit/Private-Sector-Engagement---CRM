import { z } from "zod";

export const OPPORTUNITY_PAGE_SIZE = 20;
const text = (max: number) => z.string().trim().max(max);
const optionalId = z.union([z.uuid(), z.literal("")]);
const decimal = z
  .union([z.string(), z.number().finite()])
  .transform(String)
  .pipe(
    z
      .string()
      .trim()
      .regex(/^\d{1,12}(\.\d{1,2})?$/, "Use an amount with up to 12 whole digits and two decimal places."),
  );
const money = decimal.refine(value => Number(value) > 0, "Enter an expected financial value greater than zero.");
const budget = z.union([z.literal(""), decimal]).transform(String);
const date = z.union([z.iso.date(), z.literal("")]);
const url = z.url({ protocol: /^https?$/ }).max(2048);
const raw = {
  deal_name: text(200).min(1, "Enter a deal name."),
  contact_id: z.uuid("Choose a contact."),
  primary_contact_id: optionalId,
  secondary_contact_id: optionalId,
  owner_id: z.uuid("Choose a focal person."),
  stage_id: z.uuid("Choose a stage."),
  contribution_type: z.enum(["cash", "valued_in_kind"]),
  contribution_category_id: z.uuid("Choose a contribution category."),
  expected_amount: money,
  operational_budget: budget,
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Enter a three-letter currency code, such as BDT."),
  payment_interval: text(200),
  expected_close_at: date,
  country: text(200),
  description: text(10000),
  notes: text(10000),
  drive_urls: z
    .array(z.string().trim())
    .transform(values => values.filter(Boolean))
    .pipe(z.array(url).max(20)),
  valuation_note: text(10000),
  valuation_reference_url: z.union([url, z.literal("")]),
};
export const opportunitySchema = z
  .object({
    ...raw,
    primary_contact_id: raw.primary_contact_id.default(""),
    secondary_contact_id: raw.secondary_contact_id.default(""),
    operational_budget: raw.operational_budget.default(""),
    currency: raw.currency.default("BDT"),
    payment_interval: raw.payment_interval.default(""),
    expected_close_at: raw.expected_close_at.default(""),
    country: raw.country.default(""),
    description: raw.description.default(""),
    notes: raw.notes.default(""),
    drive_urls: raw.drive_urls.default([]),
    valuation_note: raw.valuation_note.default(""),
    valuation_reference_url: raw.valuation_reference_url.default(""),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.contribution_type === "valued_in_kind" && !value.valuation_note)
      ctx.addIssue({
        code: "custom",
        path: ["valuation_note"],
        message: "Describe the agreed manual valuation and its source.",
      });
    if (value.secondary_contact_id && value.primary_contact_id === value.secondary_contact_id)
      ctx.addIssue({
        code: "custom",
        path: ["secondary_contact_id"],
        message: "Choose a different secondary contact.",
      });
  });
// No defaults in PATCH: omitted fields must preserve the stored values.
export const opportunityPatchSchema = z
  .object(raw)
  .partial()
  .strict()
  .refine(value => Object.keys(value).length > 0, "Provide at least one change.");
export type OpportunityInput = z.output<typeof opportunitySchema>;
export type OpportunityFormInput = z.input<typeof opportunitySchema>;
export const emptyOpportunity: OpportunityInput = {
  deal_name: "",
  contact_id: "",
  primary_contact_id: "",
  secondary_contact_id: "",
  owner_id: "",
  stage_id: "",
  contribution_type: "cash",
  contribution_category_id: "",
  expected_amount: "",
  operational_budget: "",
  currency: "BDT",
  payment_interval: "",
  expected_close_at: "",
  country: "",
  description: "",
  notes: "",
  drive_urls: [],
  valuation_note: "",
  valuation_reference_url: "",
};
export const opportunityListSchema = z
  .object({
    q: text(100)
      .refine(value => !value.includes("*"), "Search without the * wildcard.")
      .default(""),
    stage_id: optionalId.default(""),
    owner_id: optionalId.default(""),
    contribution_category_id: optionalId.default(""),
    contact_id: optionalId.default(""),
    contribution_type: z.enum(["", "cash", "valued_in_kind"]).default(""),
    currency: z.union([raw.currency, z.literal("")]).default(""),
    from: date.default(""),
    to: date.default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict()
  .refine(value => !value.from || !value.to || value.from <= value.to, "Closing date range is reversed.");
export type OpportunityListInput = z.output<typeof opportunityListSchema>;
export const stageSchema = z
  .object({
    name: text(100).min(1),
    position: z.number().int().min(0).max(100000),
    outcome: z.enum(["open", "won", "lost", "abandoned", "junk"]),
    active: z.boolean(),
    is_provisional: z.boolean(),
  })
  .strict();
export const categorySchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Z][A-Z0-9_]*$/)
      .max(50),
    name: text(200).min(1),
    active: z.boolean(),
    is_provisional: z.boolean(),
  })
  .strict();
export const configurationSchema = z.discriminatedUnion("entity", [
  z.object({ entity: z.literal("starter") }).strict(),
  z.object({ entity: z.literal("stage"), id: z.uuid().optional(), values: stageSchema }).strict(),
  z.object({ entity: z.literal("category"), id: z.uuid().optional(), values: categorySchema }).strict(),
]);
