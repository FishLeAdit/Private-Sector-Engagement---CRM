import { activityApi, readActivityJson, invalidateActivity } from "@/features/activities/api";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  return activityApi(request, async service => ({ data: await service.details((await params).id) }));
}
export async function PATCH(request: Request, { params }: Context) {
  return activityApi(
    request,
    async service => {
      const activity = await service.update((await params).id, await readActivityJson(request));
      invalidateActivity(activity.id);
      return { data: { activity } };
    },
    true,
  );
}
export async function DELETE(request: Request, { params }: Context) {
  return activityApi(
    request,
    async service => {
      const result = await service.remove((await params).id);
      invalidateActivity(result.id);
      return { data: result };
    },
    true,
  );
}
