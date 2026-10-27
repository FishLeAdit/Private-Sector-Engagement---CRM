import { opportunityApi, readOpportunityJson, invalidateOpportunity } from "@/features/opportunities/api";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  return opportunityApi(request, async service => ({ data: await service.details((await params).id) }));
}
export async function PATCH(request: Request, { params }: Context) {
  return opportunityApi(
    request,
    async service => {
      const opportunity = await service.update((await params).id, await readOpportunityJson(request));
      invalidateOpportunity(opportunity.id);
      return { data: { opportunity } };
    },
    true,
  );
}
export async function DELETE(request: Request, { params }: Context) {
  return opportunityApi(
    request,
    async service => {
      const result = await service.remove((await params).id);
      invalidateOpportunity(result.id);
      return { data: result };
    },
    true,
  );
}
