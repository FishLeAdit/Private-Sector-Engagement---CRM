import Link from "next/link";
import { notFound } from "next/navigation";
import type { Json } from "@/types/database.types";
import { meetingPageContext, meetingPageData } from "@/features/meetings/context";
import { canEditMeeting } from "@/features/meetings/service";
import { isPseManager } from "@/lib/auth/roles";
import { MeetingProblem } from "@/components/meetings/meeting-state";
import { MeetingContactSection, MeetingFollowUps, MeetingInformation } from "@/components/meetings/meeting-details";
import { DeleteMeetingButton } from "@/components/meetings/delete-meeting-button";
import { AuditHistory } from "@/components/ui/audit-history";
import { SavedNotice } from "@/components/ui/page";
import { formatDate } from "@/lib/dates";
import { SysCode } from "@/components/ui/hud";
import { RecordStatus } from "@/components/ui/record-status";
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
          <SysCode className="mb-1 block">{`SYS.MTG // ${id.slice(0, 8).toUpperCase()}`}</SysCode>
          <p className="mb-2">
            <RecordStatus status={row.status} label={statusLabel(row.status)} />
          </p>
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
      <SavedNotice saved={saved} noun="Meeting" />
      <div className="grid gap-6 lg:grid-cols-2">
        <MeetingInformation row={row} editable={editable} />
        <MeetingContactSection row={row} />
        <MeetingFollowUps
          meetingId={id}
          activities={history.activities}
          userId={access.userId}
          owners={options.owners}
          manager={isPseManager(access.profile)}
        />
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
