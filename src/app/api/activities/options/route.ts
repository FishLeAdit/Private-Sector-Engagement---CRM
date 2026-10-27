import { activityApi } from "@/features/activities/api";
export async function GET(request: Request) {
  return activityApi(request, async service => ({
    data: await service.options(Object.fromEntries(new URL(request.url).searchParams)),
  }));
}
