import { AppError } from "@/lib/errors";

// A sign-in account and its CRM profile. The profile fields are null for an account that has none yet.
export type Account = {
  id: string;
  email: string;
  display_name: string | null;
  department: string | null;
  role: string | null;
  active: boolean | null;
  last_sign_in_at: string | null;
};

export class AccountError extends AppError {
  name = "AccountError";
}
