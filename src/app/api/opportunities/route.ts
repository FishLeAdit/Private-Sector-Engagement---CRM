import { opportunityApi, readOpportunityJson, invalidateOpportunity } from "@/features/opportunities/api";
export async function GET(request: Request) {
  return opportunityApi(request, async service => ({ data: await service.list(Object.fromEntries(new URL(request.url).searchParams)) }));
}
export async function POST(request: Request) {
  return opportunityApi(request, async service => {
    const opportunity = await service.create(await readOpportunityJson(request)); invalidateOpportunity(opportunity.id);
    return { data: { opportunity }, status: 201 };
  }, true);
}
