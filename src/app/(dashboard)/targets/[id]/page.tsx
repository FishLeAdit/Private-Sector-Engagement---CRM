import Link from "next/link";
import { notFound } from "next/navigation";
import { financeData } from "@/features/finance/context";
import { targetPage } from "@/features/targets/context";
import { FinanceProblem } from "@/components/finance/problem";
import { ApproveTarget } from "@/components/targets/approve-target";
import { AllocationPerformance, QuarterPerformance } from "@/components/targets/target-performance";
import { isPseManager } from "@/lib/auth/roles";
import { cents, money, targetPerformance } from "@/lib/money";
import { formatDate } from "@/lib/dates";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { service, access } = await targetPage();
  const { id } = await params,
    result = await financeData(() => Promise.all([service.details(id), service.options()]));
  if (!result.ok) {
    if ([400, 404].includes(result.error.status)) notFound();
    return <FinanceProblem message={result.error.message} />;
  }
  const [{ plan, allocations, actuals, audits }, options] = result.data;
  const manager = isPseManager(access.profile),
    annual = targetPerformance(
      cents(plan.annual_amount),
      actuals.reduce((sum, a) => sum + cents(a.amount), 0n),
    );
  return (
    <>
      <Link href="/targets" className="link text-sm">
        ← Targets
      </Link>
      <div className="mb-6 mt-4 flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {plan.year} · {plan.currency} target plan
          </h1>
          <p className="mt-2 text-base-content/65">
            {plan.status === "approved"
              ? `Approved / locked by ${plan.approver?.display_name ?? "authorized manager"} · ${formatDate(plan.approved_at, true)}`
              : "Draft — provisional targets until approved"}
          </p>
        </div>
        {manager && plan.status === "draft" && (
          <Link href={`/targets/${id}/edit`} className="btn btn-outline">
            Edit draft
          </Link>
        )}
      </div>
      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Annual target", money(annual.target, plan.currency)],
          ["Actual achievement", money(annual.actual, plan.currency)],
          ["Remaining", money(annual.remaining, plan.currency)],
          ["Overachievement", money(annual.over, plan.currency)],
        ].map(([key, value]) => (
          <div key={key} className="rounded-xl border border-base-300 p-5">
            <h2 className="text-sm text-base-content/60">{key}</h2>
            <p className="mt-2 text-xl font-semibold">{value}</p>
          </div>
        ))}
      </section>
      <p className="mb-5 text-sm">
        Annual attainment: {annual.percentage === null ? "No target" : `${annual.percentage}%`}. Actuals include every
        contribution in this currency and recognition year (Asia/Dhaka), including unassigned verticals. Forecasts and
        activities contribute zero. No currency conversion or carry-forward adjustment is applied.
      </p>
      <QuarterPerformance quarters={plan.quarters} actuals={actuals} currency={plan.currency} />
      <AllocationPerformance allocations={allocations} actuals={actuals} options={options} currency={plan.currency} />
      {manager && plan.status === "draft" && <ApproveTarget id={id} stamp={plan.updated_at} />}
      <section className="mt-6 rounded-xl border border-base-300 p-5">
        <h2 className="font-semibold">Recent plan changes</h2>
        <p className="mt-2 text-xs text-base-content/60">
          Latest 20 header changes. Detailed quarter/allocation snapshots are also retained in database audit history.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {audits.map(a => (
            <li key={a.id}>
              {a.action} · {a.actor?.display_name ?? "System / historical actor"} · {formatDate(a.created_at, true)}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
