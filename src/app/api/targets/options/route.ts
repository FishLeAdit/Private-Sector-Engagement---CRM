import { targetApi } from "@/features/targets/context";
export async function GET(request: Request) {
  return targetApi(request, service => service.options());
}
