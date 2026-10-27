import "server-only";
import { createPageContext, loadPageData } from "@/lib/page-data";
import { createMeetingRepository } from "./queries";
import { createMeetingsService } from "./service";
import { MeetingError } from "./types";

export const meetingPageContext = () =>
  createPageContext((client, access) => createMeetingsService(createMeetingRepository(client), access));

export const meetingPageData = <T>(load: () => Promise<T>) => loadPageData(MeetingError, load);
