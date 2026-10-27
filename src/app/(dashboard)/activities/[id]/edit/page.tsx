import Link from "next/link";
import { notFound } from "next/navigation";
import { activityPageContext, activityPageData } from "@/features/activities/context";
import { canEditActivity, activityValues } from "@/features/activities/service";
import { isPseManager } from "@/lib/auth/roles";
import { ActivityForm } from "@/components/activities/activity-form";
import { ActivityProblem } from "@/components/activities/activity-state";
export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { access, service } = await activityPageContext();
  const { id } = await params;
  const result = await activityPageData(() => Promise.all([service.get(id), service.options()]));
  if (!result.ok) {
    if ([400, 404].includes(result.error.status)) notFound();
    return <ActivityProblem message={result.error.message} />;
  }
  const [row, options] = result.data;
  if (!canEditActivity(access, row))
    return <ActivityProblem message="Only the owner, creator or an authorized manager may edit this activity." />;
  const owners = options.owners.some(owner => owner.id === row.owner_id)
    ? options.owners
    : [...options.owners, { id: row.owner_id, display_name: row.owner?.display_name ?? "Former owner", active: false }];
  return (
    <>
      <Link href={`/activities/${id}`} className="link text-sm">
        ← Activity details
      </Link>
      <h1 className="mb-7 mt-4 text-3xl font-bold">Edit activity</h1>
      <ActivityForm
        activityId={id}
        initial={activityValues(row)}
        options={{ owners, contact: row.contact, opportunity: row.opportunity, meeting: row.meeting }}
        manager={isPseManager(access.profile)}
        userId={access.userId}
      />
    </>
  );
}
