import Link from "next/link";
import { redirect } from "next/navigation";
import { meetingPageContext, meetingPageData } from "@/features/meetings/context";
import { MEETING_PAGE_SIZE, meetingListSchema } from "@/features/meetings/schemas";
import { MeetingFilters } from "@/components/meetings/meeting-filters";
import { MeetingProblem } from "@/components/meetings/meeting-state";
import { MeetingTable } from "@/components/meetings/meeting-table";
import { ListHeader, StatusNotice } from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { listHref, pageCount } from "@/lib/list-href";

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { service } = await meetingPageContext();
  const { deleted, ...filters } = await searchParams;
  const parsed = meetingListSchema.safeParse(filters);
  if (!parsed.success)
    return <MeetingProblem message={parsed.error.issues[0]?.message ?? "Choose valid meeting filters."} />;
  const input = parsed.data;
  const result = await meetingPageData(() =>
    Promise.all([
      service.list(input),
      service.options({ contact_id: input.contact_id, opportunity_id: input.opportunity_id }),
    ]),
  );
  if (!result.ok) return <MeetingProblem message={result.error.message} />;
  const [{ meetings, count }, options] = result.data;
  const pages = pageCount(count, MEETING_PAGE_SIZE);
  const link = (page: number) => listHref("/meetings", input, page);
  if (input.page > pages) redirect(link(pages));
  return (
    <>
      <ListHeader
        code={`SYS.MTG // ${count} ${count === 1 ? "RECORD" : "RECORDS"}`}
        title="Meetings"
        description="Schedule conversations, record completion and keep linked follow-up tasks."
      >
        <Link href="/meetings/new" className="btn btn-primary">
          New meeting
        </Link>
      </ListHeader>
      {deleted === "1" && <StatusNotice>Meeting deleted successfully.</StatusNotice>}
      <MeetingFilters input={input} options={options} />
      <p className="mb-4 text-xs text-base-content/60">
        Times use Asia/Dhaka. Upcoming means Scheduled from now onward; Completed means Done. View and status filters
        apply together.
      </p>
      <MeetingTable rows={meetings} />
      <Pagination
        summary={`${count} matching meetings`}
        page={input.page}
        pages={pages}
        label="Meeting pages"
        href={link}
      />
    </>
  );
}
