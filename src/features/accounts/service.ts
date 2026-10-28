import "server-only";
import type { z } from "zod";
import type { AccessResult } from "@/lib/auth/session";
import { assertVerifiedPse } from "@/lib/auth/guards";
import { isSuperadmin } from "@/lib/auth/roles";
import { parseOrThrow, requireUuid } from "@/lib/validation";
import type { AccountRepository } from "./queries";
import { accountCreateSchema, accountUpdateSchema, passwordSchema } from "./schemas";
import { AccountError } from "./types";

type AuthResult = { error: { code?: string; status?: number } | null };
// The Supabase Auth admin calls the service uses (see lib/supabase/admin.ts); null when not configured.
export type SignInAdmin = {
  createUser(attributes: {
    email: string;
    password: string;
    email_confirm: boolean;
  }): Promise<AuthResult & { data: { user: { id: string } | null } }>;
  updateUserById(id: string, attributes: { password: string }): Promise<AuthResult>;
  deleteUser(id: string): Promise<AuthResult>;
} | null;

const parse = <T>(schema: z.ZodType<T>, input: unknown) =>
  parseOrThrow(schema, input, AccountError, "Review the account details.");
const validId = (id: string) => requireUuid(id, AccountError, "Invalid account ID.");
const notConfigured = () =>
  new AccountError(
    503,
    "Sign-in changes need SUPABASE_SERVICE_ROLE_KEY on the server. Profiles can still be edited and restricted.",
  );

// Only an active superadmin manages accounts. The SQL functions check again for profile changes; sign-in
// changes use the service role, so this check is what guards them.
export function createAccountsService(repo: AccountRepository, signIn: SignInAdmin, access: AccessResult) {
  function authorize() {
    const actor = assertVerifiedPse(access, AccountError, "PSE access is required.");
    if (!isSuperadmin(actor.profile)) throw new AccountError(403, "Only a superadmin can manage accounts.");
    return actor;
  }
  return {
    canChangeSignIn: !!signIn,
    async list() {
      authorize();
      return repo.list();
    },
    // Creates the sign-in account, then its profile; a failed profile removes the new sign-in again.
    async create(input: unknown) {
      authorize();
      const { email, password, ...profile } = parse(accountCreateSchema, input);
      if (!signIn) throw notConfigured();
      const { data, error } = await signIn.createUser({ email, password, email_confirm: true });
      if (error?.code === "email_exists" || (error?.status === 422 && !data.user))
        throw new AccountError(409, "An account with this email already exists.", {
          email: ["An account with this email already exists."],
        });
      if (error || !data.user) throw new AccountError(503, "The sign-in account could not be created. Try again.");
      try {
        await repo.save(data.user.id, profile);
      } catch (failure) {
        await signIn.deleteUser(data.user.id);
        throw failure;
      }
      return { id: data.user.id };
    },
    async update(id: string, input: unknown) {
      const actor = authorize();
      const values = parse(accountUpdateSchema, input);
      if (validId(id) === actor.userId && (values.role !== "admin" || !values.active || values.department !== "PSE"))
        throw new AccountError(422, "You cannot remove your own superadmin access.");
      await repo.save(id, values);
      return { id };
    },
    async setPassword(id: string, input: unknown) {
      authorize();
      const { password } = parse(passwordSchema, input);
      if (!signIn) throw notConfigured();
      const { error } = await signIn.updateUserById(validId(id), { password });
      if (error?.status === 404) throw new AccountError(404, "Account not found.");
      if (error) throw new AccountError(503, "The password could not be changed. Try again.");
      return { id };
    },
    // Deletes the profile (refused when it has history) and then the sign-in account.
    async remove(id: string) {
      const actor = authorize();
      if (validId(id) === actor.userId) throw new AccountError(422, "You cannot delete your own account.");
      await repo.remove(id);
      if (!signIn) return { deleted: true, id, signInRemoved: false };
      const { error } = await signIn.deleteUser(id);
      if (error && error.status !== 404)
        throw new AccountError(503, "The profile was deleted, but the sign-in account was not. Try deleting again.");
      return { deleted: true, id, signInRemoved: true };
    },
  };
}
