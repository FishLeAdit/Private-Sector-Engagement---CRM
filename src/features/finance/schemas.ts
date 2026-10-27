import { z } from "zod";
export const amount = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, "Use up to 12 whole digits and two decimal places.");
export const positiveAmount = amount.refine(value => Number(value) > 0, "Enter an amount greater than zero.");
export const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Use a three-letter currency code.");
export const optionalId = z.union([z.uuid(), z.literal("")]);
export const contributionSchema = z
  .object({
    request_id: z.uuid(),
    opportunity_id: z.uuid(),
    employee_id: z.uuid(),
    target_vertical_id: optionalId.default(""),
    amount: positiveAmount,
    currency,
    contribution_type: z.enum(["cash", "valued_in_kind"]),
    recognized_at: z.iso.datetime({ offset: true }).transform(value => new Date(value).toISOString()),
    approved_value_note: z.string().trim().max(10000).default(""),
    valuation_reference_url: z.union([z.url({ protocol: /^https?$/ }).max(2048), z.literal("")]).default(""),
    notes: z.string().trim().max(10000).default(""),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.contribution_type === "valued_in_kind" && !value.approved_value_note)
      ctx.addIssue({
        code: "custom",
        path: ["approved_value_note"],
        message: "Describe the agreed value and operational-team estimate source.",
      });
  });
export type ContributionInput = z.output<typeof contributionSchema>;
export const contributionFilters = z
  .object({
    opportunity_id: optionalId.default(""),
    employee_id: optionalId.default(""),
    target_vertical_id: optionalId.default(""),
    currency: z.union([currency, z.literal("")]).default(""),
    from: z.union([z.iso.date(), z.literal("")]).default(""),
    to: z.union([z.iso.date(), z.literal("")]).default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict()
  .refine(v => !v.from || !v.to || v.from <= v.to, "Date range is reversed.");
export const targetSchema = z
  .object({
    request_id: z.uuid(),
    expected_updated_at: z.union([z.iso.datetime({ offset: true }), z.literal("")]),
    year: z.coerce.number().int().min(1).max(9998),
    currency,
    annual_amount: positiveAmount,
    quarters: z.array(z.object({ quarter: z.number().int().min(1).max(4), amount }).strict()).length(4),
    allocations: z
      .array(
        z
          .object({ quarter: z.number().int().min(1).max(4), employee_id: z.uuid(), vertical_id: z.uuid(), amount })
          .strict(),
      )
      .max(4000),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (new Set(v.quarters.map(q => q.quarter)).size !== 4)
      ctx.addIssue({ code: "custom", path: ["quarters"], message: "Provide Q1–Q4 exactly once." });
    const keys = v.allocations.map(a => `${a.quarter}:${a.employee_id}:${a.vertical_id}`);
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({
        code: "custom",
        path: ["allocations"],
        message: "Each employee/vertical combination may occur once per quarter.",
      });
  });
export type TargetInput = z.output<typeof targetSchema>;
export const verticalSchema = z
  .object({
    id: z.uuid().optional(),
    values: z
      .object({
        code: z
          .string()
          .trim()
          .regex(/^[A-Z][A-Z0-9_]*$/)
          .max(50),
        name: z.string().trim().min(1).max(200),
        active: z.boolean(),
        is_provisional: z.boolean(),
      })
      .strict(),
  })
  .strict();
