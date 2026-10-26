import { meetingApi, readMeetingJson, invalidateMeeting } from "@/features/meetings/api";
export async function GET(request: Request) {
  return meetingApi(request, async service => ({ data: await service.list(Object.fromEntries(new URL(request.url).searchParams)) }));
}
export async function POST(request: Request) {
  return meetingApi(request, async service => {
    const meeting = await service.create(await readMeetingJson(request)); invalidateMeeting(meeting.id);
    return { data: { meeting }, status: 201 };
  }, true);
}
