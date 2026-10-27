import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createApiHandler, readJsonBody } from "@/lib/api/handler";
import type { AccessResult } from "@/lib/auth/session";
import { invalidateReportCache } from "@/lib/cache/invalidation";
import { revalidateSections } from "@/lib/cache/paths";
import { createPageContext, loadPageData } from "@/lib/page-data";
import { createFinanceRepository } from "./queries";
import { createFinanceService } from "./service";
import { FinanceError } from "./types";

type FinanceService = ReturnType<typeof createFinanceService>;

const createService = (client: SupabaseClient<Database>, access: AccessResult) =>
  createFinanceService(createFinanceRepository(client), access);

export const financePage = () => createPageContext(createService);

export const financeData = <T>(load: () => Promise<T>) => loadPageData(FinanceError, load);

// Target forms carry up to 4,000 allocation cells, hence the larger body limit.
export function financeJson(request: Request) {
  return readJsonBody(request, FinanceError, {
    maxLength: 1000000,
    notJson: "Send JSON.",
    tooLarge: "This financial form is too large.",
    invalid: "Invalid JSON.",
  });
}

const handle = createApiHandler({
  ErrorClass: FinanceError,
  createService,
  crossOriginMessage: "Submit from this CRM application.",
  unavailableMessage: "Financial records are temporarily unavailable.",
});

// Finance routes return the service result as the response body and always answer 200 on success.
export function financeApi(
  request: Request,
  run: (service: FinanceService) => Promise<unknown>,
  mutation = false,
  manager = false,
) {
  return handle(request, async service => ({ data: await run(service) }), mutation, manager);
}

// Targets, receipts and verticals feed reports, deal pages and the vertical filter options.
export function invalidateFinance() {
  invalidateReportCache(true);
  revalidateSections("/targets", "/contributions", "/opportunities", "/dashboard", "/reports");
}
