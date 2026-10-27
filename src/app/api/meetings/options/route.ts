import { meetingApi } from "@/features/meetings/api";
export async function GET(request: Request) {
  return meetingApi(request, async service => ({
    data: await service.options(Object.fromEntries(new URL(request.url).searchParams)),
  }));
}
