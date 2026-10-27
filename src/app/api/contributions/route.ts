import { contributionApi } from "@/features/contributions/context";
import { financeJson, invalidateFinance } from "@/features/finance/context";
export async function GET(request: Request) {
  return contributionApi(request, service =>
    service.contributions(Object.fromEntries(new URL(request.url).searchParams)),
  );
}
export async function POST(request: Request) {
  return contributionApi(
    request,
    async service => {
      const contribution = await service.record(await financeJson(request));
      invalidateFinance();
      return { contribution };
    },
    true,
  );
}
