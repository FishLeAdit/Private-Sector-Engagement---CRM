import Link from "next/link";
import { redirect } from "next/navigation";
import { opportunityPageContext, opportunityPageData } from "@/features/opportunities/context";
import { OPPORTUNITY_PAGE_SIZE, opportunityListSchema } from "@/features/opportunities/schemas";
import { canEditOpportunity } from "@/features/opportunities/service";
import { OpportunityBoard } from "@/components/opportunities/opportunity-board";
import { OpportunityFilters } from "@/components/opportunities/opportunity-filters";
import { OpportunityProblem, PipelineSetupNeeded } from "@/components/opportunities/opportunity-state";
import { OpportunityTable } from "@/components/opportunities/opportunity-table";
import { ListHeader, StatusNotice } from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { listHref, pageCount } from "@/lib/list-href";
import { cents, formatCents } from "@/lib/money";

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { service, access } = await opportunityPageContext();
  const { view = "list", deleted, ...filters } = await searchParams;
  const parsed = opportunityListSchema.safeParse(filters);
  if (!parsed.success || !["list", "board"].includes(String(view)))
    return <OpportunityProblem message={parsed.error?.issues[0]?.message ?? "Choose list or board view."} />;
  const input = parsed.data;
  const result = await opportunityPageData(() => Promise.all([service.list(input), service.options()]));
  if (!result.ok) return <OpportunityProblem message={result.error.message} />;
  const [{ opportunities, count }, options] = result.data;
  const pages = pageCount(count, OPPORTUNITY_PAGE_SIZE);
  const link = (page = input.page, mode = String(view)) => listHref("/opportunities", { ...input, view: mode }, page);
  if (input.page > pages) redirect(link(pages));

  // Expected values per currency for the deals shown; currencies are never combined.
  const totals = new Map<string, bigint>();
  for (const row of opportunities)
    totals.set(row.currency, (totals.get(row.currency) ?? BigInt(0)) + cents(row.expected_amount));
  const viewLink = (mode: "list" | "board", label: string) => (
    <Link
      href={link(input.page, mode)}
      aria-current={view === mode ? "page" : undefined}
      className={`btn btn-sm join-item ${view === mode ? "btn-primary" : "btn-outline"}`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <ListHeader title="Opportunities" description="Financial opportunities and their expected value.">
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
        <p className="text-xs text-base-content/65">
          Expected values on this page, all displayed stages:{" "}
          {[...totals].map(([currency, total]) => formatCents(total, currency)).join(" · ") || "No deals"}
        </p>
      </div>
      <p className="mb-4 text-xs text-base-content/60">
        Expected value is forecast, including historical closed deals when displayed. A Won stage does not record
        received funds. Currencies are kept separate.
      </p>
      {!opportunities.length ? (
        <section className="rounded-xl border border-base-300 p-10 text-center">
          <h2 className="text-xl font-semibold">No matching opportunities</h2>
          <p className="my-3 text-base-content/65">Create a financial deal or adjust your filters.</p>
          <Link href="/opportunities/new" className="btn btn-outline">
            New deal
          </Link>
        </section>
      ) : view === "board" ? (
        <OpportunityBoard
          rows={opportunities}
          stages={options.stages}
          canMove={row => canEditOpportunity(access, row)}
        />
      ) : (
        <OpportunityTable rows={opportunities} />
      )}
      <Pagination
        summary={`${count} matching deals`}
        page={input.page}
        pages={pages}
        label="Opportunity pages"
        href={page => link(page)}
      />
    </>
  );
}
