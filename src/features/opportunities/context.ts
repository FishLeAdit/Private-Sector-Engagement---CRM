import "server-only";
import { createPageContext, loadPageData } from "@/lib/page-data";
import { createOpportunityRepository } from "./queries";
import { createOpportunitiesService } from "./service";
import { OpportunityError } from "./types";

export const opportunityPageContext = () =>
  createPageContext((client, access) => createOpportunitiesService(createOpportunityRepository(client), access));

export const opportunityPageData = <T>(load: () => Promise<T>) => loadPageData(OpportunityError, load);
