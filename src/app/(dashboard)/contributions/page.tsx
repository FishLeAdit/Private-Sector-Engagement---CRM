import Link from "next/link";
import { redirect } from "next/navigation";
import { contributionPage } from "@/features/contributions/context";
import { financeData } from "@/features/finance/context";
import { contributionFilters } from "@/features/contributions/schemas";
import { FinanceProblem } from "@/components/finance/problem";
import { ContributionFilters } from "@/components/contributions/contribution-filters";
import { ListHeader } from "@/components/ui/page";
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
      <ListHeader
        title="Recognized contributions"
        description="Actual received cash and confirmed valued in-kind support."
      >
        <Link href="/contributions/new" className="btn btn-primary">
          Record contribution
        </Link>
      </ListHeader>
      <ContributionFilters input={input} options={options} />
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
