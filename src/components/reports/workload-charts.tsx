import type { CountMetric, Report } from "@/features/reports/types";
import { activityStatusLabels, activityTypeLabels, workCategoryLabels } from "@/features/activities/schemas";
import { CategoryBars } from "@/components/charts/category-bars";
import { ChartFrame } from "@/components/charts/chart-frame";
import { MonthColumns } from "@/components/charts/month-columns";
import { labelFor, monthLabel } from "./format";

const capitalize = (key: string) => key[0].toUpperCase() + key.slice(1);

// A count breakdown as horizontal bars. With `highlight`, that key (e.g. "done") carries the accent and the
// rest are context; otherwise every bar is the accent. `sorted` orders largest first (nominal categories).
function CountChart({
  title,
  code,
  metrics,
  label,
  highlight,
  sorted = false,
}: {
  title: string;
  code: string;
  metrics: CountMetric[];
  label: (key: string) => string;
  highlight?: string;
  sorted?: boolean;
}) {
  const total = metrics.reduce((sum, m) => sum + m.count, 0);
  const rows = (sorted ? [...metrics].sort((a, b) => b.count - a.count) : metrics).map(m => ({
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

// Activity and meeting breakdowns, then small multiples of each per month (Done against everything logged).
export function WorkloadCharts({ report }: { report: Report }) {
  const { workload: w, trends } = report;
  const months = (count: (t: Report["trends"][number]) => number, done: (t: Report["trends"][number]) => number) =>
    trends.map(t => ({
      label: monthLabel(t.month),
      logged: count(t),
      loggedLabel: String(count(t)),
      done: done(t),
      doneLabel: String(done(t)),
    }));
  const activityMonths = months(
      t => t.activities,
      t => t.completed_activities,
    ),
    meetingMonths = months(
      t => t.meetings,
      t => t.done_meetings,
    );
  return (
    <>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <CountChart
          title="Activities by type"
          code="ACT-T"
          metrics={w.types}
          label={key => labelFor(key, activityTypeLabels)}
          sorted
        />
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
            label={capitalize}
            highlight="done"
          />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {[
          { title: "Activity records by month", code: "ACT-M", rows: activityMonths, logged: "Logged" },
          { title: "Meeting records by month", code: "MTG-M", rows: meetingMonths, logged: "Scheduled" },
        ].map(chart => (
          <ChartFrame
            key={chart.title}
            title={chart.title}
            code={chart.code}
            legend={[
              { label: chart.logged, tone: "neutral", mark: "bar" },
              { label: "Done", tone: "accent", mark: "bar" },
            ]}
            empty={chart.rows.every(r => r.logged === 0)}
            table={{
              columns: ["Month", chart.logged, "Done"],
              rows: chart.rows.map(r => [r.label, r.loggedLabel, r.doneLabel]),
            }}
          >
            <MonthColumns
              rows={chart.rows}
              series={[
                { key: "logged", name: chart.logged, tone: "neutral" },
                { key: "done", name: "Done", tone: "accent" },
              ]}
            />
          </ChartFrame>
        ))}
      </div>
    </>
  );
}
