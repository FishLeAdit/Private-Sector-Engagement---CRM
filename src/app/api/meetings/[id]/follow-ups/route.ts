import { meetingApi, readMeetingJson, invalidateMeeting } from "@/features/meetings/api";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return meetingApi(
    request,
    async service => {
      const id = (await params).id,
        activity = await service.createFollowUp(id, await readMeetingJson(request));
      invalidateMeeting(id);
      return { data: { activity }, status: 201 };
    },
    true,
  );
}
