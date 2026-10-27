import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { financeData } from "@/features/finance/context";
import { targetPage } from "@/features/targets/context";
import { FinanceProblem } from "@/components/finance/problem";
import { Pagination } from "@/components/ui/pagination";
import { isPseManager } from "@/lib/auth/roles";
import { listHref, pageCount } from "@/lib/list-href";
import { money } from "@/lib/money";
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { service, access } = await targetPage();
  const parsed = z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .safeParse((await searchParams).page ?? 1);
  if (!parsed.success) return <FinanceProblem message="Choose a valid page." />;
  const page = parsed.data,
    result = await financeData(() => service.plans({ page }));
  if (!result.ok) return <FinanceProblem message={result.error.message} />;
  const { plans, count } = result.data;
  const pages = pageCount(count, 20);
  const link = (page: number) => listHref("/targets", {}, page);
  if (page > pages) redirect(link(pages));
  return (
    <>
      <div className="mb-6 flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Targets</h1>
          <p className="mt-2 text-base-content/65">
            Fixed annual and quarterly targets with employee/vertical allocation.
          </p>
        </div>
        {isPseManager(access.profile) && (
          <div className="flex gap-3">
            <Link href="/targets/verticals" className="btn btn-outline">
              Configure verticals
            </Link>
            <Link href="/targets/new" className="btn btn-primary">
              New target plan
            </Link>
          </div>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-base-300">
        <table className="table">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Annual target</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {plans.map(p => (
              <tr key={p.id}>
                <td>
                  <Link className="link" href={`/targets/${p.id}`}>
                    {p.year} · {p.currency}
                  </Link>
                </td>
                <td>{money(p.annual_amount, p.currency)}</td>
                <td>{p.status === "approved" ? "Approved / locked" : "Draft"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!plans.length && (
          <p className="p-8 text-center">No target plans yet. An authorized manager can create the first draft.</p>
        )}
      </div>
      <Pagination summary={`${count} plans`} page={page} pages={pages} label="Target pages" href={link} />
    </>
  );
}
