import { z } from "zod";
import { amount, currency, positiveAmount } from "@/features/finance/schemas";

// A whole draft: annual amount, four quarter baselines and the employee × vertical allocation grid.
// Drafts may be incomplete; reconciliation is enforced only on approval.
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
export type VerticalInput = z.output<typeof verticalSchema>;
