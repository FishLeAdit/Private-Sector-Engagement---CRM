import "server-only";
import { createApiHandler, readJsonBody } from "@/lib/api/handler";
import { createAuthAdmin } from "@/lib/supabase/admin";
import { createAccountRepository } from "./queries";
import { createAccountsService } from "./service";
import { AccountError } from "./types";

export function readAccountJson(request: Request) {
  return readJsonBody(request, AccountError, {
    maxLength: 4096,
    notJson: "Send account details as JSON.",
    tooLarge: "Account details are too large.",
    invalid: "Account details contain invalid JSON.",
  });
}

// Superadmin only: the service checks the role, and the SQL functions check it again for profile changes.
export const accountApi = createApiHandler({
  ErrorClass: AccountError,
  createService: (client, access) => createAccountsService(createAccountRepository(client), createAuthAdmin(), access),
  crossOriginMessage: "Manage accounts from this CRM application.",
  unavailableMessage: "Accounts are temporarily unavailable. Please try again.",
});
