import { financeApi, financeJson, invalidateFinance } from "@/features/finance/context";
import { FinanceError } from "@/features/finance/types";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return financeApi(request, async service => service.details((await params).id));
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return financeApi(
    request,
    async service => {
      const body = await financeJson(request);
      const requestId = body && typeof body === "object" && "request_id" in body ? body.request_id : undefined;
      if (requestId !== (await params).id) throw new FinanceError(422, "Submission ID must match the target plan.");
      const result = await service.save(body);
      invalidateFinance();
      return result;
    },
    true,
    true,
  );
}
