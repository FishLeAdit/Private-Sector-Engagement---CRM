import Link from "next/link";
import {
  activityTitle,
  activityTypes,
  activityTypeLabels,
  workCategories,
  workCategoryLabels,
  activityStatuses,
  activityStatusLabels,
} from "@/features/activities/schemas";
import type { ActivityRecord } from "@/features/activities/types";
import { formatDate } from "@/lib/dates";

// Related context prefers the typed-in person/organization, then whatever the linked records provide.
export function ActivityTable({ rows }: { rows: ActivityRecord[] }) {
  if (!rows.length)
    return (
      <div className="overflow-x-auto rounded-xl border border-base-300">
        <section className="p-10 text-center">
          <h2 className="text-xl font-semibold">No matching activities</h2>
          <p className="my-3 text-base-content/65">
            Create an activity or adjust the filters. Independent work needs no CRM links.
          </p>
          <Link href="/activities/new" className="btn btn-outline">
            New activity
          </Link>
        </section>
      </div>
    );
  return (
    <div className="overflow-x-auto rounded-xl border border-base-300">
      <table className="table">
        <caption className="sr-only">Activities matching the selected filters</caption>
        <thead>
          <tr>
            <th>Activity / type</th>
            <th>Status / category</th>
            <th>Related context</th>
            <th>Relevant date/time</th>
            <th>Owner</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id}>
              <td>
                <Link href={`/activities/${row.id}`} className="link link-hover font-semibold">
                  {activityTitle(row)}
                </Link>
                <p className="mt-1 text-xs text-base-content/60">
                  {activityTypeLabels[row.activity_type as (typeof activityTypes)[number]]}
                </p>
              </td>
              <td>
                <span className="badge badge-ghost">
                  {activityStatusLabels[row.status as (typeof activityStatuses)[number]]}
                </span>
                <p className="mt-1 text-xs text-base-content/60">
                  {workCategoryLabels[row.work_category as (typeof workCategories)[number]]}
                </p>
              </td>
              <td>
                <p>{row.related_person_name || row.contact?.name || row.meeting?.contact?.name || "—"}</p>
                <p className="mt-1 text-xs text-base-content/60">
                  {row.related_organization_name ||
                    row.opportunity?.deal_name ||
                    row.meeting?.title ||
                    row.contact?.company?.name ||
                    "Independent work"}
                </p>
              </td>
              <td className="whitespace-nowrap">
                {row.occurred_at ? formatDate(row.occurred_at, true) : "Not recorded"}
              </td>
              <td>{row.owner?.display_name ?? "Former owner"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
