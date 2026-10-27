import "server-only";
import { createApiHandler, readJsonBody } from "@/lib/api/handler";
import { invalidateReportCache } from "@/lib/cache/invalidation";
import { revalidateRecordPages, revalidateSections } from "@/lib/cache/paths";
import { createMeetingRepository } from "./queries";
import { createMeetingsService } from "./service";
import { MeetingError } from "./types";

export function readMeetingJson(request: Request) {
  return readJsonBody(request, MeetingError, {
    maxLength: 65536,
    notJson: "Send meeting details as JSON.",
    tooLarge: "Meeting details are too large.",
    invalid: "Meeting details contain invalid JSON.",
  });
}

export const meetingApi = createApiHandler({
  ErrorClass: MeetingError,
  createService: (client, access) => createMeetingsService(createMeetingRepository(client), access),
  crossOriginMessage: "Submit this request from the CRM application.",
  unavailableMessage: "Meetings are temporarily unavailable. Please try again.",
});

// Meetings feed workload reports and appear on contact, deal and follow-up activity pages.
export function invalidateMeeting(id: string) {
  invalidateReportCache(false);
  revalidateSections("/dashboard", "/reports", "/contacts", "/opportunities", "/activities");
  revalidateRecordPages("/meetings", id);
}
