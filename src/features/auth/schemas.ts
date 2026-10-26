import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254),
  password: z.string().min(1, "Enter your password.").max(4096),
});

export type AuthFormState = { error: string };
