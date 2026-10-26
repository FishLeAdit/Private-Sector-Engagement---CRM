import { activityApi, readActivityJson, invalidateActivity } from "@/features/activities/api";
export async function GET(request: Request) { return activityApi(request, async service => ({ data: await service.list(Object.fromEntries(new URL(request.url).searchParams)) })); }
export async function POST(request: Request) { return activityApi(request, async service => { const activity = await service.create(await readActivityJson(request)); invalidateActivity(activity.id); return { data: { activity }, status: 201 }; }, true); }
