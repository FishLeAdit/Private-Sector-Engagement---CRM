import Link from "next/link";
import { redirect } from "next/navigation";
import { contributionPage } from "@/features/contributions/context";
import { financeData } from "@/features/finance/context";
import { contributionFilters } from "@/features/contributions/schemas";
import { FinanceProblem } from "@/components/finance/problem";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/dates";
import { listHref, pageCount } from "@/lib/list-href";
import { money } from "@/lib/money";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { service } = await contributionPage();
  const parsed = contributionFilters.safeParse(await searchParams);
  if (!parsed.success) return <FinanceProblem message={parsed.error.issues[0].message} />;
  const input = parsed.data,
    result = await financeData(() => Promise.all([service.contributions(input), service.options()]));
  if (!result.ok) return <FinanceProblem message={result.error.message} />;
  const [{ contributions, count }, options] = result.data;
  const pages = pageCount(count, 20);
  const link = (page: number) => listHref("/contributions", input, page);
  if (input.page > pages) redirect(link(pages));
  return (
    <>
      <div className="mb-6 flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Recognized contributions</h1>
          <p className="mt-2 text-base-content/65">Actual received cash and confirmed valued in-kind support.</p>
        </div>
        <Link href="/contributions/new" className="btn btn-primary">
          Record contribution
        </Link>
      </div>
      <form className="mb-6 space-y-3 rounded-lg border border-base-300 p-4" action="/contributions">
        {input.opportunity_id && <input type="hidden" name="opportunity_id" value={input.opportunity_id} />}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs">
            Employee
            <select name="employee_id" defaultValue={input.employee_id} className="select select-bordered mt-1 w-full">
              <option value="">All employees</option>
              {options.employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.display_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Vertical
            <select
              name="target_vertical_id"
              defaultValue={input.target_vertical_id}
              className="select select-bordered mt-1 w-full"
            >
              <option value="">All verticals</option>
              {options.verticals.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Currency
            <input
              name="currency"
              defaultValue={input.currency}
              maxLength={3}
              className="input input-bordered mt-1 w-full"
            />
          </label>
          <label className="text-xs">
            Recognition date from (Dhaka)
            <input type="date" name="from" defaultValue={input.from} className="input input-bordered mt-1 w-full" />
          </label>
          <label className="text-xs">
            Recognition date to (Dhaka)
            <input type="date" name="to" defaultValue={input.to} className="input input-bordered mt-1 w-full" />
          </label>
        </div>
        <button className="btn btn-outline btn-sm">Apply filters</button>
        <Link href="/contributions" className="btn btn-ghost btn-sm">
          Reset
        </Link>
      </form>
      <div className="overflow-x-auto rounded-xl border border-base-300">
        <table className="table">
          <thead>
            <tr>
              <th>Opportunity</th>
              <th>Actual contribution</th>
              <th>Recognition date</th>
              <th>Employee / vertical</th>
            </tr>
          </thead>
          <tbody>
            {contributions.map(row => (
              <tr key={row.id}>
                <td>
                  <Link className="link" href={`/contributions/${row.id}`}>
                    {row.opportunity?.deal_name ?? "Contribution"}
                  </Link>
                </td>
                <td>
                  {money(row.amount, row.currency)}
                  <p className="mt-1 text-xs">{row.contribution_type === "cash" ? "Cash" : "Valued in-kind"}</p>
                </td>
                <td>{formatDate(row.recognized_at, true)}</td>
                <td>
                  {row.employee?.display_name ?? "Historical employee"}
                  <p className="mt-1 text-xs">{row.vertical?.name ?? "Unassigned"}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!contributions.length && (
          <p className="p-8 text-center">
            No matching contributions. Expected opportunity values are not actual achievement.
          </p>
        )}
      </div>
      <Pagination
        summary={`${count} matching contributions`}
        page={input.page}
        pages={pages}
        label="Contribution pages"
        href={link}
      />
    </>
  );
}
