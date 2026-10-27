import { financeJson, invalidateFinance } from "@/features/finance/context";
import { targetApi } from "@/features/targets/context";
export async function GET(request: Request) {
  return targetApi(request, service => service.plans(Object.fromEntries(new URL(request.url).searchParams)));
}
export async function POST(request: Request) {
  return targetApi(
    request,
    async service => {
      const result = await service.save(await financeJson(request));
      invalidateFinance();
      return result;
    },
    true,
    true,
  );
}
