import { meetingApi, readMeetingJson, invalidateMeeting } from "@/features/meetings/api";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  return meetingApi(request, async service => ({ data: await service.details((await params).id) }));
}
export async function PATCH(request: Request, { params }: Context) {
  return meetingApi(
    request,
    async service => {
      const meeting = await service.update((await params).id, await readMeetingJson(request));
      invalidateMeeting(meeting.id);
      return { data: { meeting } };
    },
    true,
  );
}
export async function DELETE(request: Request, { params }: Context) {
  return meetingApi(
    request,
    async service => {
      const result = await service.remove((await params).id);
      invalidateMeeting(result.id);
      return { data: result };
    },
    true,
  );
}
