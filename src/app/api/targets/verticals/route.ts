import { financeJson, invalidateFinance } from "@/features/finance/context";
import { targetApi } from "@/features/targets/context";
export async function POST(request: Request) {
  return targetApi(
    request,
    async service => {
      const result = await service.vertical(await financeJson(request));
      invalidateFinance();
      return result;
    },
    true,
    true,
  );
}
