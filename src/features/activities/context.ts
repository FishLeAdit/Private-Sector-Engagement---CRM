import "server-only";
import { createPageContext, loadPageData } from "@/lib/page-data";
import { createActivityRepository } from "./queries";
import { createActivitiesService } from "./service";
import { ActivityError } from "./types";

export const activityPageContext = () =>
  createPageContext((client, access) => createActivitiesService(createActivityRepository(client), access));

export const activityPageData = <T>(load: () => Promise<T>) => loadPageData(ActivityError, load);
