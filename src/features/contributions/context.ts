import "server-only";
import { createFinanceApi, type FinanceServiceFactory } from "@/features/finance/context";
import { createPageContext } from "@/lib/page-data";
import { createContributionRepository } from "./queries";
import { createContributionsService } from "./service";

const createService: FinanceServiceFactory<ReturnType<typeof createContributionsService>> = (client, access) =>
  createContributionsService(createContributionRepository(client), access);

export const contributionPage = () => createPageContext(createService);

export const contributionApi = createFinanceApi(createService);
