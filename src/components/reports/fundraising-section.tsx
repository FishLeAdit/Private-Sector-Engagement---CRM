import Link from "next/link";
import type { QuarterPoint } from "@/features/reports/quarters";
import type { Report } from "@/features/reports/types";
import { cents, money, targetPerformance } from "@/lib/money";
import { TapeMeter } from "@/components/charts/tape-meter";
import { Notice, Readout } from "@/components/ui/hud";
import { FundraisingCharts } from "./fundraising-charts";
import { SectionHeader } from "./section-header";
import { StatCards } from "./stat-cards";

type Props = {
  report: Report;
  monthly: boolean; // Monthly periods have actuals only: no monthly targets are defined.
  detailed: boolean; // The Reports page adds the full employee/vertical table.
  quarters: QuarterPoint[] | null; // Full-year views only.
};

const share = (part: string, whole: string) =>
  cents(whole) === 0n ? "0%" : `${Math.round(Number((cents(part) * 1000n) / cents(whole)) / 10)}%`;

// Recognized contributions against targets. Pipeline expectations are deliberately kept out of this section.
export function FundraisingSection({ report, monthly, detailed, quarters }: Props) {
  const { currency, fundraising: funds } = report;
  const totals = funds.target === null ? null : targetPerformance(cents(funds.target), cents(funds.actual));
  const targetLabel = funds.target_status === "draft" ? "Draft target" : "Assigned target";
  return (
    <section id="fundraising" aria-labelledby="fundraising-heading" className="scroll-mt-16 space-y-5">
      <SectionHeader id="fundraising-heading" index="01" code="FIN-01" title="Monetary fundraising">
        Actuals use confirmed contributions recognized in the selected period and currency. Pipeline forecasts are shown
        in their own section.
      </SectionHeader>
      {funds.target_status === "draft" && (
        <Notice tone="warning" role="status">
          This target plan is a draft. Targets are provisional until an authorized manager reviews and approves them.
        </Notice>
      )}
      {(monthly || funds.target === null) && (
        <Notice>
          {monthly
            ? "Monthly targets have not been assigned. This view shows monthly actuals without dividing quarterly targets into invented monthly quotas."
            : "No target is assigned for this selection. Actual contributions remain visible; target attainment is unavailable."}
        </Notice>
      )}
      <StatCards
        rows={[
          [targetLabel, funds.target === null ? "Not assigned" : money(funds.target, currency)],
          ["Actual achievement", money(funds.actual, currency)],
          ["Remaining", totals ? money(totals.remaining, currency) : "Not applicable"],
          ["Overachievement", totals ? money(totals.over, currency) : "Not applicable"],
        ]}
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="panel p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <Readout
              label="Attainment"
              size="lg"
              value={totals?.percentage == null || !totals ? "Not applicable" : `${totals.percentage}%`}
              detail={`${funds.receipt_count} contribution records`}
            />
            {funds.plan_id && (
              <Link className="link font-mono text-xs uppercase tracking-wider" href={`/targets/${funds.plan_id}`}>
                View target plan
              </Link>
            )}
          </div>
          <TapeMeter actual={funds.actual} target={funds.target} />
        </div>
        <div className="panel grid grid-cols-2 gap-4 p-5">
          {funds.types.map(t => (
            <Readout
              key={t.key}
              label={t.key === "cash" ? "Cash" : "Valued in-kind"}
              value={money(t.amount, currency)}
              detail={`${share(t.amount, funds.actual)} of actuals · ${t.count} records`}
            />
          ))}
        </div>
      </div>
      <FundraisingCharts report={report} quarters={quarters} />
      <p className="text-xs text-muted">
        Unassigned-vertical actuals in this selection: {money(funds.unassigned_actual, currency)}. Overachievement
        remains in its original period; later quarter targets stay fixed.
      </p>
      {detailed && <EmployeeVerticalTable rows={funds.dimensions} currency={currency} />}
    </section>
  );
}

function EmployeeVerticalTable({ rows, currency }: { rows: Report["fundraising"]["dimensions"]; currency: string }) {
  return (
    <div className="panel overflow-x-auto p-0">
      <table className="table">
        <caption className="p-4 text-left font-mono text-xs font-semibold uppercase tracking-[0.1em]">
          Employee / vertical fundraising
        </caption>
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
                <td className="min-w-32">
                  {row?.percentage == null ? "Not applicable" : `${row.percentage}%`}
                  <TapeMeter actual={d.actual} target={d.target} />
                </td>
                <td>{row ? money(row.remaining, currency) : "—"}</td>
                <td>{row ? money(row.over, currency) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!rows.length && <p className="p-5 text-sm text-muted">No matching allocations or contributions.</p>}
    </div>
  );
}
