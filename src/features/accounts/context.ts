import "server-only";
import { createAuthAdmin } from "@/lib/supabase/admin";
import { createPageContext, loadPageData } from "@/lib/page-data";
import { createAccountRepository } from "./queries";
import { createAccountsService } from "./service";
import { AccountError } from "./types";

export const accountsPageContext = () =>
  createPageContext((client, access) =>
    createAccountsService(createAccountRepository(client), createAuthAdmin(), access),
  );

export const accountsPageData = <T>(load: () => Promise<T>) => loadPageData(AccountError, load);
