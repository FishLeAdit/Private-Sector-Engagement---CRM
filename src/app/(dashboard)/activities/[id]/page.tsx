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
  workCategoryLabels,
  workCategories,
} from "@/features/activities/schemas";
import { ActivityProblem } from "@/components/activities/activity-state";
import { ActivityStatus, DeleteActivityButton } from "@/components/activities/activity-controls";
import { MeetingContactInformation } from "@/components/meetings/contact-information";
import { formatDate } from "@/lib/dates";
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
  const effectiveOpportunity = row.opportunity ?? row.meeting?.opportunity ?? null,
    contact = row.contact ?? row.meeting?.contact ?? null;
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
      {["created", "updated"].includes(saved ?? "") && (
        <p role="status" className="mb-5 rounded-lg bg-success/10 p-4 text-success">
          Activity {saved === "created" ? "created" : "updated"} successfully.
        </p>
      )}
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
        <section className="space-y-5 rounded-xl border border-base-300 p-6">
          <h2 className="text-lg font-semibold">Work details</h2>
          <dl className="grid gap-5 text-sm sm:grid-cols-2">
            {[
              ["Owner", row.owner?.display_name ?? "Former owner"],
              ["Created by", row.creator?.display_name ?? "Former creator"],
              ["Work category", workCategoryLabels[row.work_category as (typeof workCategories)[number]]],
              ["Relevant date/time (Dhaka)", row.occurred_at ? formatDate(row.occurred_at, true) : "Not recorded"],
              ["Related person", row.related_person_name || "Not provided"],
              ["Related organization", row.related_organization_name || "Not provided"],
            ].map(([name, value]) => (
              <div key={name}>
                <dt className="text-base-content/60">{name}</dt>
                <dd className="mt-1">{value}</dd>
              </div>
            ))}
          </dl>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Notes / context</h3>
            <p className="whitespace-pre-wrap break-words text-sm leading-7">{row.notes || "No notes recorded."}</p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Remaining work</h3>
            <p className="whitespace-pre-wrap break-words text-sm leading-7">
              {row.remaining_work || "No remaining work recorded."}
            </p>
          </div>
          {editable && <ActivityStatus key={`${id}:${row.status}`} id={id} status={row.status} />}
          <p className="text-xs text-base-content/60">
            Completion changes work status only. It does not record fundraising achievement or change the relevant event
            time.
          </p>
        </section>
        <section className="space-y-5 rounded-xl border border-base-300 p-6">
          <h2 className="text-lg font-semibold">Linked records</h2>
          {row.meeting && (
            <p className="text-sm">
              Meeting:{" "}
              <Link href={`/meetings/${row.meeting.id}`} className="link">
                {row.meeting.title}
              </Link>
            </p>
          )}
          {effectiveOpportunity && (
            <p className="text-sm">
              Opportunity:{" "}
              <Link href={`/opportunities/${effectiveOpportunity.id}`} className="link">
                {effectiveOpportunity.deal_name}
              </Link>
              {!row.opportunity_id && " (through meeting)"}
            </p>
          )}
          {contact || effectiveOpportunity ? (
            <MeetingContactInformation contact={contact} opportunity={effectiveOpportunity} />
          ) : (
            <p className="text-sm text-base-content/65">Independent activity with no linked CRM record.</p>
          )}
          {!row.contact_id && (contact || effectiveOpportunity) && (
            <p className="text-xs text-base-content/60">
              Contact information is derived from linked records. Text context remains separate from contact identity.
            </p>
          )}
          <h3 className="text-sm font-semibold">Document references</h3>
          <ul className="space-y-2 text-sm">
            {row.drive_urls.map((url, index) => (
              <li key={`${index}:${url}`}>
                <a href={url} target="_blank" rel="noreferrer" className="link break-all">
                  {url}
                </a>
              </li>
            ))}
          </ul>
          {!row.drive_urls.length && (
            <p className="text-sm text-base-content/65">
              No separate document URLs. References may also be recorded in Notes.
            </p>
          )}
        </section>
      </div>
      <section className="mt-6 rounded-xl border border-base-300 p-6">
        <h2 className="text-lg font-semibold">Recent changes</h2>
        <p className="mt-2 text-xs text-base-content/60">Latest 20 activity audit entries. Dates use Asia/Dhaka.</p>
        <ul className="mt-5 space-y-4">
          {audits.map(audit => {
            const before = status(audit.before),
              after = status(audit.after);
            return (
              <li key={audit.id} className="text-sm">
                <p className="font-medium">
                  {audit.action === "insert"
                    ? "Activity created"
                    : before !== after
                      ? `Status: ${label(before)} → ${label(after)}`
                      : "Activity details updated"}
                </p>
                <p className="mt-1 text-base-content/60">
                  {audit.actor?.display_name ?? "System or unavailable user"} · {formatDate(audit.created_at, true)}
                </p>
              </li>
            );
          })}
        </ul>
        {!audits.length && <p className="mt-4 text-sm">No changes recorded.</p>}
      </section>
    </>
  );
}
