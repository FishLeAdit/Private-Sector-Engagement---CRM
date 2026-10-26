import { opportunityApi, readOpportunityJson, invalidateConfiguration } from "@/features/opportunities/api";
export async function POST(request: Request) {
  return opportunityApi(request, async service => {
    const options = await service.configure(await readOpportunityJson(request)); invalidateConfiguration();
    return { data: options };
  }, true);
}
