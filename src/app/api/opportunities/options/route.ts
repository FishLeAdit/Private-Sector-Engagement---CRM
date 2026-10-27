import { opportunityApi } from "@/features/opportunities/api";
export async function GET(request: Request) {
  return opportunityApi(request, async service => ({ data: await service.options() }));
}
