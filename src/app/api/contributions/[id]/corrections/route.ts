import { contributionApi } from "@/features/contributions/context";
import { financeJson, invalidateFinance } from "@/features/finance/context";
// Manager-only and permanent: a correction is a new negative entry against the receipt.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return contributionApi(
    request,
    async service => {
      const contribution = await service.correct((await params).id, await financeJson(request));
      invalidateFinance();
      return { contribution };
    },
    true,
    true,
  );
}
