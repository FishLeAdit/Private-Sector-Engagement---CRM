import Link from "next/link";
import { redirect } from "next/navigation";
import { cardLimits, cardsParam } from "@/features/opportunities/board";
import { opportunityPageContext, opportunityPageData } from "@/features/opportunities/context";
import { OPPORTUNITY_PAGE_SIZE, opportunityListSchema } from "@/features/opportunities/schemas";
import { canEditOpportunity } from "@/features/opportunities/service";
import { OpportunityBoard, totalsText } from "@/components/opportunities/opportunity-board";
import { OpportunityFilters } from "@/components/opportunities/opportunity-filters";
import { OpportunityProblem, PipelineSetupNeeded } from "@/components/opportunities/opportunity-state";
import { OpportunityTable } from "@/components/opportunities/opportunity-table";
import { ListHeader, StatusNotice } from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { listHref, pageCount } from "@/lib/list-href";

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { service, access } = await opportunityPageContext();
  const { view = "list", deleted, cards, ...filters } = await searchParams;
  const parsed = opportunityListSchema.safeParse(filters);
  if (!parsed.success || !["list", "board"].includes(String(view)))
    return <OpportunityProblem message={parsed.error?.issues[0]?.message ?? "Choose list or board view."} />;
  const input = parsed.data,
    board = view === "board";
  // The board has no pages: it loads every stage's counts and totals and its latest cards instead.
  const result = await opportunityPageData(async () => {
    if (board) return { ...(await service.board(input, cards)), list: null };
    const [list, options, summary] = await Promise.all([
      service.list(input),
      service.options(),
      service.summary(input),
    ]);
    return { list, options, summary, columns: null };
  });
  if (!result.ok) return <OpportunityProblem message={result.error.message} />;
  const { list, options, summary, columns } = result.data;
  const count = list?.count ?? summary.count;
  const pages = pageCount(count, OPPORTUNITY_PAGE_SIZE);
  const link = (page = input.page, mode = String(view), extra: Record<string, string> = {}) =>
    listHref("/opportunities", { ...input, view: mode, ...extra }, page);
  if (list && input.page > pages) redirect(link(pages));
  const limits = cardLimits(cards);

  const viewLink = (mode: "list" | "board", label: string) => (
    <Link
      href={link(mode === "board" ? 1 : input.page, mode)}
      aria-current={view === mode ? "page" : undefined}
      className={`btn btn-sm join-item ${view === mode ? "btn-primary" : "btn-outline"}`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <ListHeader
        code={`SYS.OPP // ${count} ${count === 1 ? "RECORD" : "RECORDS"}`}
        title="Opportunities"
        description="Financial opportunities and their expected value."
      >
        <Link className="btn btn-primary" href="/opportunities/new">
          New deal
        </Link>
      </ListHeader>
      {deleted === "1" && <StatusNotice>Opportunity deleted successfully.</StatusNotice>}
      {(!options.stages.some(row => row.active) || !options.categories.some(row => row.active)) && (
        <div className="mb-6">
          <PipelineSetupNeeded />
        </div>
      )}
      <OpportunityFilters input={input} view={String(view)} options={options} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Opportunity view" className="join">
          {viewLink("list", "List")}
          {viewLink("board", "Stage board")}
        </nav>
        <p className="text-xs text-muted">
          Expected value of all {summary.count} matching {summary.count === 1 ? "deal" : "deals"}:{" "}
          {totalsText(summary.totals) || "none"}
        </p>
      </div>
      <p className="mb-4 text-xs text-base-content/60">
        Expected value is forecast, including historical closed deals when displayed. A Won stage does not record
        received funds. Currencies are kept separate.
      </p>
      {!count ? (
        <section className="panel p-10 text-center">
          <h2 className="text-xl font-semibold">No matching opportunities</h2>
          <p className="my-3 text-base-content/65">Create a financial deal or adjust your filters.</p>
          <Link href="/opportunities/new" className="btn btn-outline">
            New deal
          </Link>
        </section>
      ) : columns ? (
        <OpportunityBoard
          columns={columns}
          stages={options.stages}
          canMove={row => canEditOpportunity(access, row)}
          moreHref={(stageId, limit) => link(1, "board", { cards: cardsParam(limits, stageId, limit) })}
          stageListHref={stageId => link(1, "list", { stage_id: stageId })}
        />
      ) : (
        <OpportunityTable rows={list?.opportunities ?? []} />
      )}
      {list && (
        <Pagination
          summary={`${count} matching deals`}
          page={input.page}
          pages={pages}
          label="Opportunity pages"
          href={page => link(page)}
        />
      )}
    </>
  );
}
