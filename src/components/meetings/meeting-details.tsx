import Link from "next/link";
import type { MeetingHistory, MeetingOwner, MeetingRecord } from "@/features/meetings/types";
import { formatDate } from "@/lib/dates";
import { MeetingContactInformation } from "./contact-information";
import { FollowUpForm } from "./follow-up-form";
import { MeetingStatus } from "./meeting-status";

// Sections of the meeting detail page.

export function MeetingInformation({ row, editable }: { row: MeetingRecord; editable: boolean }) {
  return (
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
      {editable && <MeetingStatus key={`${row.id}:${row.status}`} id={row.id} status={row.status} />}
    </section>
  );
}

// A deal-only meeting shows the deal's primary contact (or party) without a separate contact link.
export function MeetingContactSection({ row }: { row: MeetingRecord }) {
  return (
    <section className="rounded-xl border border-base-300 p-6">
      <h2 className="mb-5 text-lg font-semibold">Contact information</h2>
      <MeetingContactInformation contact={row.contact} opportunity={row.opportunity} />
      {!row.contact_id && (
        <p className="mt-4 text-xs text-base-content/60">
          Contact information is derived from the opportunity’s primary contact or party. No separate contact link was
          required.
        </p>
      )}
    </section>
  );
}

export function MeetingFollowUps({
  meetingId,
  activities,
  userId,
  owners,
  manager,
}: {
  meetingId: string;
  activities: MeetingHistory["activities"];
  userId: string;
  owners: MeetingOwner[];
  manager: boolean;
}) {
  return (
    <section className="rounded-xl border border-base-300 p-6">
      <h2 className="text-lg font-semibold">Linked activities and follow-ups</h2>
      <p className="mt-2 text-xs text-base-content/60">Latest 20 activities directly linked to this meeting.</p>
      <ul className="mt-5 space-y-4">
        {activities.map(item => (
          <li key={item.id} className="border-b border-base-300 pb-4 last:border-0">
            <Link href={`/activities/${item.id}`} className="link link-hover whitespace-pre-wrap break-words text-sm">
              {item.notes || item.activity_type.replaceAll("_", " ")}
            </Link>
            <p className="mt-2 text-xs capitalize text-base-content/60">
              {item.activity_type.replaceAll("_", " ")} · {item.status.replaceAll("_", " ")} ·{" "}
              {item.owner?.display_name ?? "Former owner"}
            </p>
            <p className="mt-1 text-xs text-base-content/60">{formatDate(item.occurred_at ?? item.created_at, true)}</p>
            {item.remaining_work && (
              <p className="mt-2 whitespace-pre-wrap text-sm">Remaining: {item.remaining_work}</p>
            )}
          </li>
        ))}
      </ul>
      {!activities.length && <p className="mt-4 text-sm text-base-content/65">No linked activities yet.</p>}
      <h3 className="mt-6 border-t border-base-300 pt-5 font-semibold">Create a follow-up</h3>
      <FollowUpForm meetingId={meetingId} userId={userId} owners={owners} manager={manager} />
    </section>
  );
}
