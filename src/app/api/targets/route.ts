import { financeApi, financeJson, invalidateFinance } from "@/features/finance/context";
export async function GET(request: Request) {
  return financeApi(request, service => service.plans(Object.fromEntries(new URL(request.url).searchParams)));
}
export async function POST(request: Request) {
  return financeApi(
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
