import Link from "next/link";
import { activityPageContext, activityPageData } from "@/features/activities/context";
import { activityOptionsSchema } from "@/features/activities/schemas";
import { isPseManager } from "@/lib/auth/roles";
import { ActivityForm } from "@/components/activities/activity-form";
import { ActivityProblem } from "@/components/activities/activity-state";
export default async function NewActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { access, service } = await activityPageContext(); const parsed = activityOptionsSchema.safeParse(await searchParams);
  if (!parsed.success) return <ActivityProblem message="Choose valid contact/opportunity/meeting links." />;
  const result = await activityPageData(() => service.options(parsed.data)); if (!result.ok) return <ActivityProblem message={result.error.message} />;
  return <><Link href="/activities" className="link text-sm">← Activities</Link><h1 className="mb-7 mt-4 text-3xl font-bold">New activity</h1><ActivityForm options={result.data} manager={isPseManager(access.profile)} userId={access.userId} /></>;
}
