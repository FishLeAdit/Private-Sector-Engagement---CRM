import Link from "next/link";
import { redirect } from "next/navigation";
import { activityPageContext, activityPageData } from "@/features/activities/context";
import {
  activityListSchema,
  ACTIVITY_PAGE_SIZE,
  activityTypes,
  activityTypeLabels,
  workCategories,
  workCategoryLabels,
  activityStatuses,
  activityStatusLabels,
  activityTitle,
} from "@/features/activities/schemas";
import { ActivityProblem } from "@/components/activities/activity-state";
import { formatDate } from "@/lib/dates";
export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { service } = await activityPageContext();
  const { deleted, ...filters } = await searchParams;
  const parsed = activityListSchema.safeParse(filters);
  if (!parsed.success)
    return <ActivityProblem message={parsed.error.issues[0]?.message ?? "Choose valid activity filters."} />;
  const input = parsed.data;
  const result = await activityPageData(() =>
    Promise.all([
      service.list(input),
      service.options({
        contact_id: input.contact_id,
        opportunity_id: input.opportunity_id,
        meeting_id: input.meeting_id,
      }),
    ]),
  );
  if (!result.ok) return <ActivityProblem message={result.error.message} />;
  const [{ activities, count }, options] = result.data,
    pages = Math.max(1, Math.ceil(count / ACTIVITY_PAGE_SIZE));
  const link = (page: number) =>
    `/activities?${new URLSearchParams(Object.fromEntries(Object.entries({ ...input, page }).map(([key, value]) => [key, String(value)])))}`;
  if (input.page > pages) redirect(link(pages));
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Activities</h1>
          <p className="mt-2 text-base-content/65">Independent work, relationship engagement and linked follow-ups.</p>
        </div>
        <Link href="/activities/new" className="btn btn-primary">
          New activity
        </Link>
      </div>
      {deleted === "1" && (
        <p role="status" className="mb-5 rounded-lg bg-success/10 p-4 text-success">
          Activity deleted successfully.
        </p>
      )}
      <form action="/activities" className="mb-5 rounded-xl border border-base-300 p-4">
        {(["contact_id", "opportunity_id", "meeting_id"] as const).map(field =>
          input[field] ? <input key={field} type="hidden" name={field} value={input[field]} /> : null,
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs">
            Search notes / related context
            <input name="q" defaultValue={input.q} maxLength={100} className="input input-bordered mt-1 w-full" />
          </label>
          <label className="block text-xs">
            Activity type
            <select
              name="activity_type"
              defaultValue={input.activity_type}
              className="select select-bordered mt-1 w-full"
            >
              <option value="all">All types</option>
              {activityTypes.map(type => (
                <option key={type} value={type}>
                  {activityTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            Work category
            <select
              name="work_category"
              defaultValue={input.work_category}
              className="select select-bordered mt-1 w-full"
            >
              <option value="all">All categories</option>
              {workCategories.map(category => (
                <option key={category} value={category}>
                  {workCategoryLabels[category]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            Status
            <select name="status" defaultValue={input.status} className="select select-bordered mt-1 w-full">
              <option value="all">All statuses</option>
              {activityStatuses.map(status => (
                <option key={status} value={status}>
                  {activityStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            Owner
            <select name="owner_id" defaultValue={input.owner_id} className="select select-bordered mt-1 w-full">
              <option value="">All owners</option>
              {options.owners.map(owner => (
                <option key={owner.id} value={owner.id}>
                  {owner.display_name}
                  {!owner.active && " (inactive)"}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            Relevant date from (Dhaka)
            <input type="date" name="from" defaultValue={input.from} className="input input-bordered mt-1 w-full" />
          </label>
          <label className="block text-xs">
            Relevant date to (Dhaka)
            <input type="date" name="to" defaultValue={input.to} className="input input-bordered mt-1 w-full" />
          </label>
        </div>
        {(options.contact || options.opportunity || options.meeting) && (
          <p className="mt-4 text-sm text-base-content/65">
            Direct links:{" "}
            {[options.contact?.name, options.opportunity?.deal_name, options.meeting?.title]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button className="btn btn-outline btn-sm">Apply filters</button>
          <Link href="/activities" className="btn btn-ghost btn-sm">
            Reset
          </Link>
        </div>
      </form>
      <p className="mb-4 text-xs text-base-content/60">
        Date filters use relevant activity time in Asia/Dhaka; undated work is included when no date range is set.
        Record filters match direct links.
      </p>
      <div className="overflow-x-auto rounded-xl border border-base-300">
        {activities.length ? (
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
              {activities.map(row => (
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
        ) : (
          <section className="p-10 text-center">
            <h2 className="text-xl font-semibold">No matching activities</h2>
            <p className="my-3 text-base-content/65">
              Create an activity or adjust the filters. Independent work needs no CRM links.
            </p>
            <Link href="/activities/new" className="btn btn-outline">
              New activity
            </Link>
          </section>
        )}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p>
          {count} matching activities · Page {input.page} of {pages}
        </p>
        <nav aria-label="Activity pages" className="flex gap-2">
          {input.page > 1 && (
            <Link href={link(input.page - 1)} className="btn btn-outline btn-sm">
              Previous
            </Link>
          )}
          {input.page < pages && (
            <Link href={link(input.page + 1)} className="btn btn-outline btn-sm">
              Next
            </Link>
          )}
        </nav>
      </div>
    </>
  );
}
