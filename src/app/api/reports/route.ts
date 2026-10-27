import { reportsApi } from "@/features/reports/context";
export async function GET(request: Request) {
  return reportsApi(request);
}
