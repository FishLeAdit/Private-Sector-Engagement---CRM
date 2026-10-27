import Link from "next/link";
import { notFound } from "next/navigation";
import { activityPageContext, activityPageData } from "@/features/activities/context";
import { canEditActivity } from "@/features/activities/service";
import {
  activityTitle,
  activityTypeLabels,
  activityTypes,
  activityStatusLabels,
  activityStatuses,
} from "@/features/activities/schemas";
import { ActivityProblem } from "@/components/activities/activity-state";
import { DeleteActivityButton } from "@/components/activities/activity-controls";
import { ActivityLinkedRecords, ActivityWorkDetails } from "@/components/activities/activity-details";
import { AuditHistory } from "@/components/ui/audit-history";
import { SavedNotice } from "@/components/ui/page";
import type { Json } from "@/types/database.types";
function status(value: Json) {
  return value && typeof value === "object" && !Array.isArray(value) && typeof value.status === "string"
    ? value.status
    : null;
}
export default async function ActivityDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { service, access } = await activityPageContext();
  const { id } = await params;
  const result = await activityPageData(() => service.details(id));
  if (!result.ok) {
    if ([400, 404].includes(result.error.status)) notFound();
    return <ActivityProblem message={result.error.message} />;
  }
  const { activity: row, audits } = result.data,
    editable = canEditActivity(access, row),
    title = activityTitle(row),
    saved = (await searchParams).saved;
  const label = (value: string | null) =>
    activityStatusLabels[value as (typeof activityStatuses)[number]] ?? value ?? "Unknown";
  return (
    <>
      <Link href="/activities" className="link text-sm">
        ← Activities
      </Link>
      <div className="mb-6 mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-sm text-base-content/65">
            {activityTypeLabels[row.activity_type as (typeof activityTypes)[number]]} · {label(row.status)}
          </p>
          <h1 className="break-words text-3xl font-bold">{title}</h1>
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2">
            <Link href={`/activities/${id}/edit`} className="btn btn-outline">
              Edit activity
            </Link>
            <DeleteActivityButton id={id} title={title} />
          </div>
        )}
      </div>
      <SavedNotice saved={saved} noun="Activity" />
      {!row.contact_id &&
        !row.opportunity_id &&
        !row.meeting_id &&
        !row.related_person_name?.trim() &&
        !row.related_organization_name?.trim() && (
          <p className="mb-5 rounded-lg bg-warning/10 p-4 text-sm">
            This older activity is missing related context. Add a person or organization when editing it.
          </p>
        )}
      <div className="grid gap-6 lg:grid-cols-2">
        <ActivityWorkDetails row={row} editable={editable} />
        <ActivityLinkedRecords row={row} />
      </div>
      <AuditHistory
        className="mt-6"
        audits={audits}
        note="Latest 20 activity audit entries. Dates use Asia/Dhaka."
        describe={audit => {
          const before = status(audit.before);
          const after = status(audit.after);
          if (audit.action === "insert") return "Activity created";
          if (before !== after) return `Status: ${label(before)} → ${label(after)}`;
          return "Activity details updated";
        }}
      />
    </>
  );
}
