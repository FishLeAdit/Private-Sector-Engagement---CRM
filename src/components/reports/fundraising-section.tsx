import Link from "next/link";
import type { Report } from "@/features/reports/types";
import { cents, money, targetPerformance } from "@/lib/money";
import { ReportBars } from "./bars";
import { monthLabel } from "./format";
import { StatCards } from "./stat-cards";

type Props = {
  report: Report;
  monthly: boolean; // Monthly periods have actuals only: no monthly targets are defined.
  detailed: boolean; // The Reports page adds the full employee/vertical table.
};

// Recognized contributions against targets. Pipeline expectations are deliberately kept out of this section.
export function FundraisingSection({ report, monthly, detailed }: Props) {
  const { currency, fundraising: funds, trends } = report;
  const totals = funds.target === null ? null : targetPerformance(cents(funds.target), cents(funds.actual));
  const targetLabel = funds.target_status === "draft" ? "Draft target" : "Assigned target";
  return (
    <section aria-labelledby="fundraising-heading" className="space-y-5">
      <div>
        <h2 id="fundraising-heading" className="text-2xl font-bold">
          Monetary fundraising
        </h2>
        <p className="mt-2 text-sm text-base-content/65">
          Actuals use confirmed contributions recognized in the selected period and currency. Pipeline forecasts are
          shown in their own section.
        </p>
      </div>
      {funds.target_status === "draft" && (
        <p role="status" className="rounded-lg bg-warning/10 p-4 text-sm">
          This target plan is a draft. Targets are provisional until an authorized manager reviews and approves them.
        </p>
      )}
      {(monthly || funds.target === null) && (
        <p className="rounded-lg bg-base-200 p-4 text-sm">
          {monthly
            ? "Monthly targets have not been assigned. This view shows monthly actuals without dividing quarterly targets into invented monthly quotas."
            : "No target is assigned for this selection. Actual contributions remain visible; target attainment is unavailable."}
        </p>
      )}
      <StatCards
        rows={[
          [targetLabel, funds.target === null ? "Not assigned" : money(funds.target, currency)],
          ["Actual achievement", money(funds.actual, currency)],
          ["Remaining", totals ? money(totals.remaining, currency) : "Not applicable"],
          ["Overachievement", totals ? money(totals.over, currency) : "Not applicable"],
        ]}
      />
      <div className="flex flex-wrap justify-between gap-3 text-sm">
        <p>
          Attainment:{" "}
          <strong>{totals?.percentage === null || !totals ? "Not applicable" : `${totals.percentage}%`}</strong> ·{" "}
          {funds.receipt_count} contribution records
        </p>
        {funds.plan_id && (
          <Link className="link" href={`/targets/${funds.plan_id}`}>
            View target plan
          </Link>
        )}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ReportBars
          title="Actual cash and valued in-kind"
          rows={funds.types.map(t => ({
            label: t.key === "cash" ? "Cash" : "Valued in-kind",
            value: t.amount,
            display: money(t.amount, currency),
          }))}
        />
        <ReportBars
          title="Recognized achievement by month"
          rows={trends.map(t => ({ label: monthLabel(t.month), value: t.actual, display: money(t.actual, currency) }))}
        />
      </div>
      <p className="text-xs text-base-content/60">
        Unassigned-vertical actuals in this selection: {money(funds.unassigned_actual, currency)}. Overachievement
        remains in its original period; later quarter targets stay fixed.
      </p>
      {detailed && <EmployeeVerticalTable rows={funds.dimensions} currency={currency} />}
    </section>
  );
}

function EmployeeVerticalTable({ rows, currency }: { rows: Report["fundraising"]["dimensions"]; currency: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-base-300">
      <table className="table">
        <caption className="p-4 text-left font-semibold">Employee / vertical fundraising</caption>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Vertical</th>
            <th>Target</th>
            <th>Actual</th>
            <th>Attainment</th>
            <th>Remaining</th>
            <th>Over</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(d => {
            const row = d.target === null ? null : targetPerformance(cents(d.target), cents(d.actual));
            return (
              <tr key={`${d.employee_id}:${d.vertical_id ?? "unassigned"}`}>
                <td>{d.employee_name}</td>
                <td>{d.vertical_name}</td>
                <td>{d.target === null ? "Not assigned" : money(d.target, currency)}</td>
                <td>{money(d.actual, currency)}</td>
                <td>{row?.percentage == null ? "Not applicable" : `${row.percentage}%`}</td>
                <td>{row ? money(row.remaining, currency) : "—"}</td>
                <td>{row ? money(row.over, currency) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!rows.length && <p className="p-5 text-sm text-base-content/60">No matching allocations or contributions.</p>}
    </div>
  );
}
