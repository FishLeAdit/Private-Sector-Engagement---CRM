import Link from "next/link";
import { redirect } from "next/navigation";
import { opportunityPageContext, opportunityPageData } from "@/features/opportunities/context";
import { OPPORTUNITY_PAGE_SIZE, opportunityListSchema } from "@/features/opportunities/schemas";
import { canEditOpportunity } from "@/features/opportunities/service";
import { OpportunityProblem, PipelineSetupNeeded } from "@/components/opportunities/opportunity-state";
import { StageMove } from "@/components/opportunities/stage-move";
import { formatCents, formatMoney, toCents } from "@/lib/currency";
import { formatDate } from "@/lib/dates";

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
  const pages = Math.max(1, Math.ceil(count / OPPORTUNITY_PAGE_SIZE));
  const link = (page = input.page, mode = String(view)) =>
    `/opportunities?${new URLSearchParams({ ...Object.fromEntries(Object.entries(input).map(([key, value]) => [key, String(value)])), view: mode, page: String(page) })}`;
  if (input.page > pages) redirect(link(pages));
  const totals = new Map<string, bigint>();
  for (const row of opportunities)
    totals.set(row.currency, (totals.get(row.currency) ?? BigInt(0)) + toCents(row.expected_amount));
  const select = (
    name: "stage_id" | "owner_id" | "contribution_category_id",
    label: string,
    rows: { id: string; name?: string; display_name?: string }[],
  ) => (
    <label className="block text-xs">
      {label}
      <select name={name} defaultValue={input[name]} className="select select-bordered mt-1 w-full">
        <option value="">All</option>
        {rows.map(row => (
          <option key={row.id} value={row.id}>
            {row.name ?? row.display_name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Opportunities</h1>
          <p className="mt-2 text-base-content/65">Financial opportunities and their expected value.</p>
        </div>
        <Link className="btn btn-primary" href="/opportunities/new">
          New deal
        </Link>
      </div>
      {deleted === "1" && (
        <p role="status" className="mb-5 rounded-lg bg-success/10 p-4 text-success">
          Opportunity deleted successfully.
        </p>
      )}
      {(!options.stages.some(row => row.active) || !options.categories.some(row => row.active)) && (
        <div className="mb-6">
          <PipelineSetupNeeded />
        </div>
      )}
      <form action="/opportunities" className="mb-5 rounded-xl border border-base-300 p-4">
        <input type="hidden" name="view" value={String(view)} />
        {input.contact_id && <input type="hidden" name="contact_id" value={input.contact_id} />}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs">
            Deal name
            <input
              name="q"
              defaultValue={input.q}
              maxLength={100}
              className="input input-bordered mt-1 w-full"
              placeholder="Search deals"
            />
          </label>
          {select("stage_id", "Stage", options.stages)}
          {select("owner_id", "Focal person", options.owners)}
          {select("contribution_category_id", "Category", options.categories)}
          <label className="block text-xs">
            Contribution type
            <select
              name="contribution_type"
              defaultValue={input.contribution_type}
              className="select select-bordered mt-1 w-full"
            >
              <option value="">All</option>
              <option value="cash">Cash</option>
              <option value="valued_in_kind">Valued in-kind</option>
            </select>
          </label>
          <label className="block text-xs">
            Currency
            <input
              name="currency"
              defaultValue={input.currency}
              maxLength={3}
              placeholder="e.g. BDT"
              className="input input-bordered mt-1 w-full"
            />
          </label>
          <label className="block text-xs">
            Closing from
            <input type="date" name="from" defaultValue={input.from} className="input input-bordered mt-1 w-full" />
          </label>
          <label className="block text-xs">
            Closing to
            <input type="date" name="to" defaultValue={input.to} className="input input-bordered mt-1 w-full" />
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="btn btn-outline btn-sm">Apply filters</button>
          <Link href="/opportunities" className="btn btn-ghost btn-sm">
            Reset
          </Link>
        </div>
      </form>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Opportunity view" className="join">
          <Link
            href={link(input.page, "list")}
            aria-current={view === "list" ? "page" : undefined}
            className={`btn btn-sm join-item ${view === "list" ? "btn-primary" : "btn-outline"}`}
          >
            List
          </Link>
          <Link
            href={link(input.page, "board")}
            aria-current={view === "board" ? "page" : undefined}
            className={`btn btn-sm join-item ${view === "board" ? "btn-primary" : "btn-outline"}`}
          >
            Stage board
          </Link>
        </nav>
        <p className="text-xs text-base-content/65">
          Expected values on this page, all displayed stages:{" "}
          {[...totals].map(([currency, cents]) => formatCents(cents, currency)).join(" · ") || "No deals"}
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
        <>
          <p className="mb-3 text-sm text-base-content/65">
            This board groups the current page of up to 20 deals. Use pagination to see the rest.
          </p>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {options.stages
              .filter(stage => stage.active || opportunities.some(row => row.stage_id === stage.id))
              .map(stage => {
                const rows = opportunities.filter(row => row.stage_id === stage.id);
                return (
                  <section key={stage.id} className="w-72 shrink-0 rounded-xl bg-base-200 p-3">
                    <h2 className="mb-1 font-semibold">
                      {stage.name} <span className="badge badge-sm">{rows.length}</span>
                    </h2>
                    <p className="mb-4 text-xs text-base-content/60">
                      {stage.is_provisional ? "Provisional · " : ""}
                      {stage.outcome ?? "Open"}
                      {!stage.active && " · inactive"}
                    </p>
                    <div className="space-y-3">
                      {rows.map(row => (
                        <article key={row.id} className="space-y-3 rounded-lg border border-base-300 bg-base-100 p-4">
                          <Link className="link link-hover font-semibold" href={`/opportunities/${row.id}`}>
                            {row.deal_name}
                          </Link>
                          <p className="text-sm">{formatMoney(row.expected_amount, row.currency)}</p>
                          <p className="text-xs text-base-content/65">
                            {row.contact?.name} · {row.owner?.display_name}
                            <br />
                            Closing: {formatDate(row.expected_close_at)}
                          </p>
                          {canEditOpportunity(access, row) && (
                            <StageMove
                              key={`${row.id}:${row.stage_id}`}
                              id={row.id}
                              stageId={row.stage_id}
                              stages={options.stages}
                            />
                          )}
                        </article>
                      ))}
                      {!rows.length && (
                        <p className="py-6 text-center text-sm text-base-content/60">No deals on this page.</p>
                      )}
                    </div>
                  </section>
                );
              })}
          </div>
        </>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-base-300">
          <table className="table">
            <caption className="sr-only">Opportunities matching the selected filters</caption>
            <thead>
              <tr>
                <th>Deal / contact</th>
                <th>Stage</th>
                <th>Expected value</th>
                <th>Type / category</th>
                <th>Focal person</th>
                <th>Expected closing</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map(row => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/opportunities/${row.id}`} className="link link-hover font-semibold">
                      {row.deal_name}
                    </Link>
                    <p className="mt-1 text-xs text-base-content/60">{row.contact?.name}</p>
                  </td>
                  <td>{row.stage?.name}</td>
                  <td className="whitespace-nowrap">{formatMoney(row.expected_amount, row.currency)}</td>
                  <td>
                    {row.contribution_type === "cash" ? "Cash" : "Valued in-kind"}
                    <p className="mt-1 text-xs text-base-content/60">{row.category?.name}</p>
                  </td>
                  <td>{row.owner?.display_name}</td>
                  <td>{formatDate(row.expected_close_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p>
          {count} matching deals · Page {input.page} of {pages}
        </p>
        <nav aria-label="Opportunity pages" className="flex gap-2">
          {input.page > 1 && (
            <Link className="btn btn-outline btn-sm" href={link(input.page - 1)}>
              Previous
            </Link>
          )}
          {input.page < pages && (
            <Link className="btn btn-outline btn-sm" href={link(input.page + 1)}>
              Next
            </Link>
          )}
        </nav>
      </div>
    </>
  );
}
