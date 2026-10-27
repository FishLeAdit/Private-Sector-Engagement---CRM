import "server-only";
import { revalidatePath } from "next/cache";
import { createApiHandler, readJsonBody } from "@/lib/api/handler";
import { invalidateReportCache } from "@/lib/cache/invalidation";
import { revalidateRecordPages, revalidateSections } from "@/lib/cache/paths";
import { createOpportunityRepository } from "./queries";
import { createOpportunitiesService } from "./service";
import { OpportunityError } from "./types";

export function readOpportunityJson(request: Request) {
  return readJsonBody(request, OpportunityError, {
    maxLength: 65536,
    notJson: "Send details as JSON.",
    tooLarge: "Opportunity details are too large.",
    invalid: "Details contain invalid JSON.",
  });
}

export const opportunityApi = createApiHandler({
  ErrorClass: OpportunityError,
  createService: (client, access) => createOpportunitiesService(createOpportunityRepository(client), access),
  crossOriginMessage: "Submit this request from the CRM application.",
  unavailableMessage: "Opportunities are temporarily unavailable. Please try again.",
});

// Deals feed pipeline reports and appear in contact histories.
export function invalidateOpportunity(id: string) {
  invalidateReportCache(false);
  revalidateSections("/dashboard", "/reports", "/contacts");
  revalidateRecordPages("/opportunities", id);
}

// Stage and category names appear on every deal page and in pipeline reports.
export function invalidateConfiguration() {
  invalidateReportCache(false);
  revalidateSections("/dashboard", "/reports", "/opportunities");
  revalidatePath("/settings");
}
