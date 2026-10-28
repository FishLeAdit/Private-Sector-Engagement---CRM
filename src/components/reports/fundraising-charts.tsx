import type { QuarterPoint } from "@/features/reports/quarters";
import { cumulative } from "@/features/reports/quarters";
import type { Report } from "@/features/reports/types";
import { cents, money, targetPerformance } from "@/lib/money";
import { ChartFrame } from "@/components/charts/chart-frame";
import { plotValue } from "@/components/charts/format";
import { MonthColumns } from "@/components/charts/month-columns";
import { PaceChart } from "@/components/charts/pace-chart";
import { QuarterChart } from "@/components/charts/quarter-chart";
import { monthLabel } from "./format";

const attainment = (target: string | null, actual: string | null) => {
  if (target === null || actual === null || cents(target) === 0n) return "";
  const { percentage } = targetPerformance(cents(target), cents(actual));
  return percentage === null ? "" : `${Math.round(Number(percentage))}%`;
};
const amount = (value: string | null, missing: string, currency: string) =>
  value === null ? missing : money(value, currency);
const noData = (quarters: QuarterPoint[]) => quarters.every(q => q.target === null && q.actual === null);

// Target as an outline beside the actual, per quarter (full-year views with a plan).
export function QuarterFigure({ quarters, currency }: { quarters: QuarterPoint[]; currency: string }) {
  const label = (value: string | null, missing: string) => amount(value, missing, currency);
  return (
    <ChartFrame
      title="Target vs actual by quarter"
      code="FIN-Q"
      legend={[
        { label: "Target", tone: "neutral", mark: "outline" },
        { label: "Actual", tone: "accent", mark: "bar" },
      ]}
      empty={noData(quarters)}
      table={{
        columns: ["Quarter", "Target", "Actual", "Attainment"],
        rows: quarters.map(q => [
          `Q${q.quarter}`,
          label(q.target, "Not assigned"),
          label(q.actual, "Not started"),
          attainment(q.target, q.actual) || "Not applicable",
        ]),
      }}
      note="Each quarter's target is fixed; overachievement stays in its own quarter."
    >
      <QuarterChart
        rows={quarters.map(q => ({
          label: `Q${q.quarter}`,
          target: plotValue(q.target),
          targetLabel: label(q.target, "Not assigned"),
          actual: plotValue(q.actual),
          actualLabel: label(q.actual, "Not started"),
          attainment: attainment(q.target, q.actual),
        }))}
      />
    </ChartFrame>
  );
}

// Cumulative actual against cumulative quarterly target for the year.
export function PaceFigure({ quarters, currency }: { quarters: QuarterPoint[]; currency: string }) {
  const label = (value: string | null, missing: string) => amount(value, missing, currency);
  const running = cumulative(quarters);
  return (
    <ChartFrame
      title="Year pace, cumulative"
      code="FIN-P"
      legend={[
        { label: "Cumulative target", tone: "neutral", mark: "line" },
        { label: "Cumulative actual", tone: "accent", mark: "line" },
      ]}
      empty={noData(quarters)}
      table={{
        columns: ["Quarter end", "Cumulative target", "Cumulative actual"],
        rows: running.map(q => [`Q${q.quarter}`, label(q.target, "Not assigned"), label(q.actual, "Not started")]),
      }}
    >
      <PaceChart
        rows={running.map(q => ({
          label: `Q${q.quarter}`,
          target: plotValue(q.target),
          targetLabel: label(q.target, "Not assigned"),
          actual: plotValue(q.actual),
          actualLabel: label(q.actual, "Not started"),
        }))}
      />
    </ChartFrame>
  );
}

// Recognized receipts per month of the selected period.
export function MonthReceiptsFigure({ report }: { report: Report }) {
  const { currency, trends } = report;
  const months = trends.map(t => ({
    label: monthLabel(t.month),
    actual: Number(t.actual),
    actualLabel: money(t.actual, currency),
  }));
  return (
    <ChartFrame
      title="Recognized achievement by month"
      code="FIN-M"
      empty={!trends.some(t => cents(t.actual) > 0n)}
      emptyText="No contributions recognized in this period."
      table={{ columns: ["Month", "Actual"], rows: months.map(m => [m.label, m.actualLabel]) }}
    >
      <MonthColumns rows={months} series={[{ key: "actual", name: "Actual", tone: "accent" }]} />
    </ChartFrame>
  );
}

// Quarter and pace charts (full-year views with a plan) and monthly receipts (every view).
export function FundraisingCharts({ report, quarters }: { report: Report; quarters: QuarterPoint[] | null }) {
  return (
    <>
      {quarters && (
        <div className="grid gap-5 xl:grid-cols-2">
          <QuarterFigure quarters={quarters} currency={report.currency} />
          <PaceFigure quarters={quarters} currency={report.currency} />
        </div>
      )}
      <MonthReceiptsFigure report={report} />
    </>
  );
}
