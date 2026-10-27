import "server-only";
import { createApiHandler, readJsonBody } from "@/lib/api/handler";
import { invalidateReportCache } from "@/lib/cache/invalidation";
import { revalidateRecordPages, revalidateSections } from "@/lib/cache/paths";
import { createActivityRepository } from "./queries";
import { createActivitiesService } from "./service";
import { ActivityError } from "./types";

export function readActivityJson(request: Request) {
  return readJsonBody(request, ActivityError, {
    maxLength: 65536,
    notJson: "Send activity details as JSON.",
    tooLarge: "Activity details are too large.",
    invalid: "Activity details contain invalid JSON.",
  });
}

export const activityApi = createApiHandler({
  ErrorClass: ActivityError,
  createService: (client, access) => createActivitiesService(createActivityRepository(client), access),
  crossOriginMessage: "Submit this request from the CRM application.",
  unavailableMessage: "Activities are temporarily unavailable. Please try again.",
});

// Activities feed workload reports and appear on contact, deal and meeting pages.
export function invalidateActivity(id: string) {
  invalidateReportCache(false);
  revalidateSections("/dashboard", "/reports", "/contacts", "/opportunities", "/meetings");
  revalidateRecordPages("/activities", id);
}
