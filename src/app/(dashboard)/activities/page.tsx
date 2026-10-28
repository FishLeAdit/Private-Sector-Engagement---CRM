import Link from "next/link";
import { redirect } from "next/navigation";
import { activityPageContext, activityPageData } from "@/features/activities/context";
import { activityListSchema, ACTIVITY_PAGE_SIZE } from "@/features/activities/schemas";
import { ActivityFilters } from "@/components/activities/activity-filters";
import { ActivityProblem } from "@/components/activities/activity-state";
import { ActivityTable } from "@/components/activities/activity-table";
import { ListHeader, StatusNotice } from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { listHref, pageCount } from "@/lib/list-href";

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
  const [{ activities, count }, options] = result.data;
  const pages = pageCount(count, ACTIVITY_PAGE_SIZE);
  const link = (page: number) => listHref("/activities", input, page);
  if (input.page > pages) redirect(link(pages));
  return (
    <>
      <ListHeader
        code={`SYS.ACT // ${count} ${count === 1 ? "RECORD" : "RECORDS"}`}
        title="Activities"
        description="Independent work, relationship engagement and linked follow-ups."
      >
        <Link href="/activities/new" className="btn btn-primary">
          New activity
        </Link>
      </ListHeader>
      {deleted === "1" && <StatusNotice>Activity deleted successfully.</StatusNotice>}
      <ActivityFilters input={input} options={options} />
      <p className="mb-4 text-xs text-base-content/60">
        Date filters use relevant activity time in Asia/Dhaka; undated work is included when no date range is set.
        Record filters match direct links.
      </p>
      <ActivityTable rows={activities} />
      <Pagination
        summary={`${count} matching activities`}
        page={input.page}
        pages={pages}
        label="Activity pages"
        href={link}
      />
    </>
  );
}
