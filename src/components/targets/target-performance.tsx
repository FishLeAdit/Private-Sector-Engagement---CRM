import type { FinanceOptions } from "@/features/finance/types";
import type { Actual, Allocation } from "@/features/targets/types";
import { cents, money, targetPerformance } from "@/lib/money";

// Target-vs-actual tables on the target plan page. Quarter baselines are fixed: a strong Q1 never lowers Q2.

const sumActuals = (rows: Actual[]) => rows.reduce((sum, a) => sum + cents(a.amount), 0n);

export function QuarterPerformance({
  quarters,
  actuals,
  currency,
}: {
  quarters: { quarter: number; amount: number | string }[];
  actuals: Actual[];
  currency: string;
}) {
  return (
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
              cents(quarters.find(row => row.quarter === q)?.amount ?? 0),
              sumActuals(actuals.filter(a => a.quarter === q)),
            );
            return (
              <tr key={q}>
                <td>Q{q}</td>
                <td>{money(p.target, currency)}</td>
                <td>{money(p.actual, currency)}</td>
                <td>{p.percentage === null ? "No target" : `${p.percentage}%`}</td>
                <td>{money(p.remaining, currency)}</td>
                <td>{money(p.over, currency)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

// One row per quarter × employee × vertical found in either the allocation cells or the actuals,
// so receipts outside any allocation (including unassigned verticals) still appear.
export function AllocationPerformance({
  allocations,
  actuals,
  options,
  currency,
}: {
  allocations: Allocation[];
  actuals: Actual[];
  options: FinanceOptions;
  currency: string;
}) {
  const keys = [
    ...new Set([
      ...allocations.map(a => `${a.quarter}:${a.employee_id}:${a.vertical_id}`),
      ...actuals.map(a => `${a.quarter}:${a.employee_id}:${a.vertical_id ?? ""}`),
    ]),
  ].sort();
  return (
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
            const [q, employee, vertical] = key.split(":");
            const quarter = Number(q);
            const p = targetPerformance(
              allocations
                .filter(a => a.quarter === quarter && a.employee_id === employee && a.vertical_id === vertical)
                .reduce((sum, a) => sum + cents(a.amount), 0n),
              sumActuals(
                actuals.filter(
                  a => a.quarter === quarter && a.employee_id === employee && (a.vertical_id ?? "") === vertical,
                ),
              ),
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
                <td>{money(p.target, currency)}</td>
                <td>{money(p.actual, currency)}</td>
                <td>{p.percentage === null ? "No allocated target" : `${p.percentage}%`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!keys.length && <p className="mt-4 text-sm">No allocations or actual contributions yet.</p>}
    </section>
  );
}
