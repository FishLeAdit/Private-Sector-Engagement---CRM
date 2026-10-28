import type { CountMetric, Report } from "@/features/reports/types";
import { activityStatusLabels, activityTypeLabels, workCategoryLabels } from "@/features/activities/schemas";
import { CategoryBars } from "@/components/charts/category-bars";
import { ChartFrame } from "@/components/charts/chart-frame";
import { MonthColumns } from "@/components/charts/month-columns";
import { labelFor, monthLabel } from "./format";

const capitalize = (key: string) => key[0].toUpperCase() + key.slice(1);

// A count breakdown as horizontal bars. With `highlight`, that key (e.g. "done") carries the accent and the
// rest are context; otherwise every bar is the accent. `sorted` orders largest first (nominal categories).
export function CountChart({
  title,
  code,
  metrics,
  label,
  highlight,
  sorted = false,
  limit,
}: {
  title: string;
  code: string;
  metrics: CountMetric[];
  label: (key: string) => string;
  highlight?: string;
  sorted?: boolean;
  limit?: number; // Show only the first N rows (after sorting), e.g. the top five types.
}) {
  const total = metrics.reduce((sum, m) => sum + m.count, 0);
  const rows = (sorted ? [...metrics].sort((a, b) => b.count - a.count) : metrics).slice(0, limit).map(m => ({
    label: label(m.key),
    value: m.count,
    valueLabel: total ? `${m.count} · ${Math.round((m.count / total) * 100)}%` : "0",
    tone: highlight && m.key !== highlight ? ("neutral" as const) : ("accent" as const),
  }));
  return (
    <ChartFrame
      title={title}
      code={code}
      legend={
        highlight
          ? [
              { label: label(highlight), tone: "accent", mark: "bar" },
              { label: "Other", tone: "neutral", mark: "bar" },
            ]
          : []
      }
      empty={!total}
      table={{ columns: [title, "Records", "Share"], rows: rows.map(r => [r.label, String(r.value), r.valueLabel]) }}
    >
      <CategoryBars rows={rows} series="Records" />
    </ChartFrame>
  );
}

type Trend = Report["trends"][number];

// Done against everything logged, per month: one measure per chart, never summed with the other.
export function WorkMonthFigure({ report, kind }: { report: Report; kind: "activities" | "meetings" }) {
  const meetings = kind === "meetings";
  const logged = meetings ? "Scheduled" : "Logged";
  const count = (t: Trend) => (meetings ? t.meetings : t.activities);
  const done = (t: Trend) => (meetings ? t.done_meetings : t.completed_activities);
  const rows = report.trends.map(t => ({
    label: monthLabel(t.month),
    logged: count(t),
    loggedLabel: String(count(t)),
    done: done(t),
    doneLabel: String(done(t)),
  }));
  return (
    <ChartFrame
      title={meetings ? "Meeting records by month" : "Activity records by month"}
      code={meetings ? "MTG-M" : "ACT-M"}
      legend={[
        { label: logged, tone: "neutral", mark: "bar" },
        { label: "Done", tone: "accent", mark: "bar" },
      ]}
      empty={rows.every(r => r.logged === 0)}
      table={{ columns: ["Month", logged, "Done"], rows: rows.map(r => [r.label, r.loggedLabel, r.doneLabel]) }}
    >
      <MonthColumns
        rows={rows}
        series={[
          { key: "logged", name: logged, tone: "neutral" },
          { key: "done", name: "Done", tone: "accent" },
        ]}
      />
    </ChartFrame>
  );
}

export const activityTypeLabel = (key: string) => labelFor(key, activityTypeLabels);
export const meetingStatusLabel = capitalize;

// Activity and meeting breakdowns, then small multiples of each per month.
export function WorkloadCharts({ report }: { report: Report }) {
  const { workload: w } = report;
  return (
    <>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <CountChart title="Activities by type" code="ACT-T" metrics={w.types} label={activityTypeLabel} sorted />
        <div className="grid gap-5">
          <CountChart
            title="Work categories"
            code="ACT-C"
            metrics={w.categories}
            label={key => labelFor(key, workCategoryLabels)}
            sorted
          />
          <CountChart
            title="Activity status"
            code="ACT-S"
            metrics={w.statuses}
            label={key => labelFor(key, activityStatusLabels)}
            highlight="done"
          />
          <CountChart
            title="Meeting status"
            code="MTG-S"
            metrics={w.meeting_statuses}
            label={meetingStatusLabel}
            highlight="done"
          />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <WorkMonthFigure report={report} kind="activities" />
        <WorkMonthFigure report={report} kind="meetings" />
      </div>
    </>
  );
}
