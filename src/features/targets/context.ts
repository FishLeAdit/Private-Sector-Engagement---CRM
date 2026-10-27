import "server-only";
import { createFinanceApi, type FinanceServiceFactory } from "@/features/finance/context";
import { createPageContext } from "@/lib/page-data";
import { createTargetRepository } from "./queries";
import { createTargetsService } from "./service";

const createService: FinanceServiceFactory<ReturnType<typeof createTargetsService>> = (client, access) =>
  createTargetsService(createTargetRepository(client), access);

export const targetPage = () => createPageContext(createService);

export const targetApi = createFinanceApi(createService);
