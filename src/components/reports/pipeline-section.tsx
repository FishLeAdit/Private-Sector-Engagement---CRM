import type { Report } from "@/features/reports/types";
import { money } from "@/lib/money";
import { CategoryBars } from "@/components/charts/category-bars";
import { ChartFrame } from "@/components/charts/chart-frame";
import { SectionHeader } from "./section-header";
import { StatCards } from "./stat-cards";

type Stage = Report["pipeline"]["stages"][number];
const capitalize = (key: string) => key[0].toUpperCase() + key.slice(1);
const stageName = (s: Stage) => `${s.name}${s.is_provisional ? " (provisional)" : ""}`;

const deals = (count: number) => `${count} ${count === 1 ? "deal" : "deals"}`;

// Expected value by stage in the configured order, which reads like a funnel; open stages carry the accent,
// closed ones are context.
export function StageFigure({ report }: { report: Report }) {
  const { currency, pipeline: p } = report;
  return (
    <ChartFrame
      title="Expected value by stage"
      code="OPP-S"
      legend={[
        { label: "Open stage", tone: "accent", mark: "bar" },
        { label: "Closed stage", tone: "neutral", mark: "bar" },
      ]}
      empty={!p.stages.length}
      emptyText="No opportunities close in this period."
      note={p.stages.some(s => s.is_provisional) ? "Stage names are provisional configuration." : undefined}
      table={{
        columns: ["Stage", "Outcome", "Deals", "Expected value"],
        rows: p.stages.map(s => [stageName(s), capitalize(s.outcome), String(s.count), money(s.expected, currency)]),
      }}
    >
      <CategoryBars
        series="Expected value"
        rows={p.stages.map(s => ({
          label: s.name,
          value: Number(s.expected),
          valueLabel: `${money(s.expected, currency)} · ${deals(s.count)}`,
          tone: s.outcome === "open" ? "accent" : "neutral",
        }))}
      />
    </ChartFrame>
  );
}

// Expected values by current stage. These are forecasts, never counted as achievement.
export function PipelineSection({ report, detailed }: { report: Report; detailed: boolean }) {
  const { currency, pipeline: p } = report;
  return (
    <section id="pipeline" aria-labelledby="pipeline-heading" className="mt-10 scroll-mt-16 space-y-5">
      <SectionHeader id="pipeline-heading" index="02" code="OPP-01" title="Pipeline forecast">
        Current stages of opportunities expected to close in this period, filtered by owner and currency. Funding
        vertical has no pipeline mapping.
      </SectionHeader>
      <StatCards
        rows={[
          ["Expected pipeline value", money(p.expected, currency)],
          ["Opportunities in period", String(p.count)],
          ["Missing closing date", String(p.undated_count)],
          ["Undated expected value", money(p.undated_expected, currency)],
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <StageFigure report={report} />
        <ChartFrame
          title="Deals by current outcome"
          code="OPP-O"
          legend={[
            { label: "Won", tone: "accent", mark: "bar" },
            { label: "Other outcomes", tone: "neutral", mark: "bar" },
          ]}
          empty={p.outcomes.every(o => o.count === 0)}
          emptyText="No opportunities close in this period."
          table={{
            columns: ["Outcome", "Deals", "Expected value"],
            rows: p.outcomes.map(o => [capitalize(o.key), String(o.count), money(o.expected, currency)]),
          }}
        >
          <CategoryBars
            series="Deals"
            rows={p.outcomes.map(o => ({
              label: capitalize(o.key),
              value: o.count,
              valueLabel: `${o.count} · ${money(o.expected, currency)}`,
              tone: o.key === "won" ? "accent" : "neutral",
            }))}
          />
        </ChartFrame>
      </div>
      <p className="text-xs text-muted">
        Undated opportunities are excluded from period totals. Stage outcomes are current classifications; Won is not a
        receipt or automatic achievement.
      </p>
      {detailed && <StageTable stages={p.stages} currency={currency} />}
    </section>
  );
}

function StageTable({ stages, currency }: { stages: Stage[]; currency: string }) {
  return (
    <div className="panel overflow-x-auto p-0">
      <table className="table">
        <caption className="p-4 text-left font-mono text-xs font-semibold uppercase tracking-[0.1em]">
          All matching stages
        </caption>
        <thead>
          <tr>
            <th>Stage</th>
            <th>Outcome</th>
            <th>Deals</th>
            <th>Expected value</th>
          </tr>
        </thead>
        <tbody>
          {stages.map(s => (
            <tr key={s.id}>
              <td>
                {s.name}
                {s.is_provisional && <span className="ml-2 text-xs text-muted">provisional</span>}
              </td>
              <td className="capitalize">{s.outcome}</td>
              <td>{s.count}</td>
              <td>{money(s.expected, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
