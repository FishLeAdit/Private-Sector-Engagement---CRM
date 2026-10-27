import Link from "next/link";
import type { MeetingRecord } from "@/features/meetings/types";
import { formatDate } from "@/lib/dates";
import { meetingContact } from "./contact-information";

const statusBadge = (status: string) =>
  status === "done" ? "badge-success" : status === "cancelled" ? "badge-ghost" : "badge-info";
const statusLabel = (status: string) =>
  status === "done" ? "Done" : status === "cancelled" ? "Cancelled" : "Scheduled";

// The contact column falls back to the deal's primary contact when the meeting links only a deal.
export function MeetingTable({ rows }: { rows: MeetingRecord[] }) {
  if (!rows.length)
    return (
      <div className="overflow-x-auto rounded-xl border border-base-300">
        <section className="p-10 text-center">
          <h2 className="text-xl font-semibold">No matching meetings</h2>
          <p className="my-3 text-base-content/65">Schedule a meeting or adjust your filters.</p>
          <Link href="/meetings/new" className="btn btn-outline">
            New meeting
          </Link>
        </section>
      </div>
    );
  return (
    <div className="overflow-x-auto rounded-xl border border-base-300">
      <table className="table">
        <caption className="sr-only">Meetings matching the selected filters</caption>
        <thead>
          <tr>
            <th>Meeting</th>
            <th>Date/time (Dhaka)</th>
            <th>Status</th>
            <th>Contact / opportunity</th>
            <th>Owner</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const contact = meetingContact(row.contact, row.opportunity);
            return (
              <tr key={row.id}>
                <td>
                  <Link href={`/meetings/${row.id}`} className="link link-hover font-semibold">
                    {row.title}
                  </Link>
                </td>
                <td className="whitespace-nowrap">{formatDate(row.scheduled_at, true)}</td>
                <td>
                  <span className={`badge ${statusBadge(row.status)}`}>{statusLabel(row.status)}</span>
                </td>
                <td>
                  {contact && (
                    <Link href={`/contacts/${contact.id}`} className="link link-hover">
                      {contact.name}
                    </Link>
                  )}
                  {row.opportunity && (
                    <p className="mt-1 text-xs text-base-content/65">
                      <Link href={`/opportunities/${row.opportunity.id}`} className="link link-hover">
                        {row.opportunity.deal_name}
                      </Link>
                    </p>
                  )}
                </td>
                <td>{row.owner?.display_name ?? "Former owner"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
