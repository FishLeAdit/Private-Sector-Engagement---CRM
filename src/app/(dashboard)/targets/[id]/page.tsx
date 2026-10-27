import Link from "next/link";
import { notFound } from "next/navigation";
import { financePage, financeData } from "@/features/finance/context";
import { FinanceProblem } from "@/components/finance/problem";
import { ApproveTarget } from "@/components/finance/approve-target";
import { isPseManager } from "@/lib/auth/roles";
import { cents, money, targetPerformance } from "@/lib/money";
import { formatDate } from "@/lib/dates";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { service, access } = await financePage();
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
  const keys = [
    ...new Set([
      ...allocations.map(a => `${a.quarter}:${a.employee_id}:${a.vertical_id}`),
      ...actuals.map(a => `${a.quarter}:${a.employee_id}:${a.vertical_id ?? ""}`),
    ]),
  ].sort();
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
        Annual attainment: {annual.percentage ?? "No target"}%. Actuals include every contribution in this currency and
        recognition year (Asia/Dhaka), including unassigned verticals. Forecasts and activities contribute zero. No
        currency conversion or carry-forward adjustment is applied.
      </p>
      <section className="mb-6 overflow-x-auto rounded-xl border border-base-300 p-5">
        <h2 className="mb-4 text-lg font-semibold">Quarter performance</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Quarter</th>
              <th>Fixed target</th>
              <th>Actual</th>
              <th>Attainment</th>
              <th>Remaining</th>
              <th>Over</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map(q => {
              const p = targetPerformance(
                cents(plan.quarters.find(row => row.quarter === q)?.amount ?? 0),
                actuals.filter(a => a.quarter === q).reduce((sum, a) => sum + cents(a.amount), 0n),
              );
              return (
                <tr key={q}>
                  <td>Q{q}</td>
                  <td>{money(p.target, plan.currency)}</td>
                  <td>{money(p.actual, plan.currency)}</td>
                  <td>{p.percentage === null ? "No target" : `${p.percentage}%`}</td>
                  <td>{money(p.remaining, plan.currency)}</td>
                  <td>{money(p.over, plan.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <section className="overflow-x-auto rounded-xl border border-base-300 p-5">
        <h2 className="mb-4 text-lg font-semibold">Employee / vertical performance</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Quarter</th>
              <th>Employee</th>
              <th>Vertical</th>
              <th>Target</th>
              <th>Actual</th>
              <th>Attainment</th>
            </tr>
          </thead>
          <tbody>
            {keys.map(key => {
              const [q, employee, vertical] = key.split(":"),
                quarter = Number(q),
                p = targetPerformance(
                  allocations
                    .filter(a => a.quarter === quarter && a.employee_id === employee && a.vertical_id === vertical)
                    .reduce((sum, a) => sum + cents(a.amount), 0n),
                  actuals
                    .filter(
                      a => a.quarter === quarter && a.employee_id === employee && (a.vertical_id ?? "") === vertical,
                    )
                    .reduce((sum, a) => sum + cents(a.amount), 0n),
                );
              return (
                <tr key={key}>
                  <td>Q{q}</td>
                  <td>
                    {options.employees.find(e => e.id === employee)?.display_name ??
                      allocations.find(a => a.employee_id === employee)?.employee?.display_name ??
                      "Historical employee"}
                  </td>
                  <td>
                    {vertical
                      ? (options.verticals.find(v => v.id === vertical)?.name ?? "Historical vertical")
                      : "Unassigned"}
                  </td>
                  <td>{money(p.target, plan.currency)}</td>
                  <td>{money(p.actual, plan.currency)}</td>
                  <td>{p.percentage === null ? "No allocated target" : `${p.percentage}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!keys.length && <p className="mt-4 text-sm">No allocations or actual contributions yet.</p>}
      </section>
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
