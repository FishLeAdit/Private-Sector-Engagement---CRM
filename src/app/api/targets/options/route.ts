import { financeApi } from "@/features/finance/context";
export async function GET(request: Request) {
  return financeApi(request, service => service.options());
}
