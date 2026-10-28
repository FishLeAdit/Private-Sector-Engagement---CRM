import { z } from "zod";

export const accountRoles = ["pse_member", "pse_manager", "admin"] as const;
const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.")
  .refine(value => value.trim() === value, "The password cannot start or end with a space.");
const profile = {
  display_name: z.string().trim().min(1, "Enter a name.").max(200),
  department: z.string().trim().min(1, "Enter a department.").max(100),
  role: z.enum(accountRoles),
  active: z.boolean(),
};

// A new sign-in account with its CRM profile. Only PSE profiles can use the CRM; another department makes a
// restricted account, for example to test access denial.
export const accountCreateSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.").max(254)),
    password,
    ...profile,
    department: profile.department.default("PSE"),
    active: profile.active.default(true),
  })
  .strict();
export type AccountCreateInput = z.output<typeof accountCreateSchema>;

export const accountUpdateSchema = z.object(profile).strict();
export type AccountUpdateInput = z.output<typeof accountUpdateSchema>;

export const passwordSchema = z.object({ password }).strict();
