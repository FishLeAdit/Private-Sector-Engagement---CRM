import Link from "next/link";
import { notFound } from "next/navigation";
import type { Json } from "@/types/database.types";
import { meetingPageContext, meetingPageData } from "@/features/meetings/context";
import { canEditMeeting } from "@/features/meetings/service";
import { isPseManager } from "@/lib/auth/roles";
import { MeetingProblem } from "@/components/meetings/meeting-state";
import { MeetingContactInformation } from "@/components/meetings/contact-information";
import { MeetingStatus } from "@/components/meetings/meeting-status";
import { FollowUpForm } from "@/components/meetings/follow-up-form";
import { DeleteMeetingButton } from "@/components/meetings/delete-meeting-button";
import { AuditHistory } from "@/components/ui/audit-history";
import { formatDate } from "@/lib/dates";
const statusLabel = (value: string | null) =>
  value === "done" ? "Done" : value === "scheduled" ? "Scheduled" : value === "cancelled" ? "Cancelled" : "Unknown";
function auditStatus(value: Json) {
  return value && typeof value === "object" && !Array.isArray(value) && typeof value.status === "string"
    ? value.status
    : null;
}
export default async function MeetingDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { service, access } = await meetingPageContext();
  const { id } = await params;
  const result = await meetingPageData(() => Promise.all([service.details(id), service.options()]));
  if (!result.ok) {
    if ([400, 404].includes(result.error.status)) notFound();
    return <MeetingProblem message={result.error.message} />;
  }
  const [{ meeting: row, history }, options] = result.data,
    editable = canEditMeeting(access, row),
    saved = (await searchParams).saved;
  return (
    <>
      <Link href="/meetings" className="link text-sm">
        ← Meetings
      </Link>
      <div className="mb-6 mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-sm text-base-content/65">{statusLabel(row.status)}</p>
          <h1 className="break-words text-3xl font-bold">{row.title}</h1>
          <p className="mt-2 text-base-content/65">{formatDate(row.scheduled_at, true)} · Asia/Dhaka</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/activities/new?meeting_id=${id}`} className="btn btn-primary">
            Log activity
          </Link>
          <Link href={`/activities?meeting_id=${id}`} className="btn btn-ghost">
            View activities
          </Link>
          {editable && (
            <>
              <Link href={`/meetings/${id}/edit`} className="btn btn-outline">
                Edit meeting
              </Link>
              <DeleteMeetingButton meetingId={id} title={row.title} />
            </>
          )}
        </div>
      </div>
      {["created", "updated"].includes(saved ?? "") && (
        <p role="status" className="mb-5 rounded-lg bg-success/10 p-4 text-success">
          Meeting {saved === "created" ? "created" : "updated"} successfully.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-5 rounded-xl border border-base-300 p-6">
          <h2 className="text-lg font-semibold">Meeting information</h2>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-base-content/60">Owner</dt>
              <dd className="mt-1">{row.owner?.display_name ?? "Former owner"}</dd>
            </div>
            <div>
              <dt className="text-base-content/60">Created by</dt>
              <dd className="mt-1">{row.creator?.display_name ?? "Former creator"}</dd>
            </div>
            <div>
              <dt className="text-base-content/60">Opportunity</dt>
              <dd className="mt-1">
                {row.opportunity ? (
                  <Link href={`/opportunities/${row.opportunity.id}`} className="link">
                    {row.opportunity.deal_name}
                  </Link>
                ) : (
                  "Contact-only meeting"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-base-content/60">Description</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words leading-7">
                {row.description || "No description recorded."}
              </dd>
            </div>
          </dl>
          {editable && <MeetingStatus key={`${id}:${row.status}`} id={id} status={row.status} />}
        </section>
        <section className="rounded-xl border border-base-300 p-6">
          <h2 className="mb-5 text-lg font-semibold">Contact information</h2>
          <MeetingContactInformation contact={row.contact} opportunity={row.opportunity} />
          {!row.contact_id && (
            <p className="mt-4 text-xs text-base-content/60">
              Contact information is derived from the opportunity’s primary contact or party. No separate contact link
              was required.
            </p>
          )}
        </section>
        <section className="rounded-xl border border-base-300 p-6">
          <h2 className="text-lg font-semibold">Linked activities and follow-ups</h2>
          <p className="mt-2 text-xs text-base-content/60">Latest 20 activities directly linked to this meeting.</p>
          <ul className="mt-5 space-y-4">
            {history.activities.map(item => (
              <li key={item.id} className="border-b border-base-300 pb-4 last:border-0">
                <Link
                  href={`/activities/${item.id}`}
                  className="link link-hover whitespace-pre-wrap break-words text-sm"
                >
                  {item.notes || item.activity_type.replaceAll("_", " ")}
                </Link>
                <p className="mt-2 text-xs capitalize text-base-content/60">
                  {item.activity_type.replaceAll("_", " ")} · {item.status.replaceAll("_", " ")} ·{" "}
                  {item.owner?.display_name ?? "Former owner"}
                </p>
                <p className="mt-1 text-xs text-base-content/60">
                  {formatDate(item.occurred_at ?? item.created_at, true)}
                </p>
                {item.remaining_work && (
                  <p className="mt-2 whitespace-pre-wrap text-sm">Remaining: {item.remaining_work}</p>
                )}
              </li>
            ))}
          </ul>
          {!history.activities.length && <p className="mt-4 text-sm text-base-content/65">No linked activities yet.</p>}
          <h3 className="mt-6 border-t border-base-300 pt-5 font-semibold">Create a follow-up</h3>
          <FollowUpForm
            meetingId={id}
            userId={access.userId}
            owners={options.owners}
            manager={isPseManager(access.profile)}
          />
        </section>
        <AuditHistory
          audits={history.audits}
          note="Latest 20 meeting audit entries. Dates use Asia/Dhaka."
          describe={audit => {
            const before = auditStatus(audit.before);
            const after = auditStatus(audit.after);
            if (audit.action === "insert") return "Meeting created";
            if (before !== after) return `Status: ${statusLabel(before)} → ${statusLabel(after)}`;
            return "Meeting details updated";
          }}
        />
      </div>
    </>
  );
}
