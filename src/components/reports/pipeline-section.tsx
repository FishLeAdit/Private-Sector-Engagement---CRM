import type { Report } from "@/features/reports/types";
import { cents, money } from "@/lib/money";
import { ReportBars } from "./bars";
import { StatCards } from "./stat-cards";

type Stage = Report["pipeline"]["stages"][number];

// The chart shows at most 12 stages, largest expected value first; the detailed table lists them all.
function topStages(stages: Stage[]) {
  return [...stages]
    .sort((a, b) =>
      cents(a.expected) === cents(b.expected)
        ? a.name.localeCompare(b.name)
        : cents(a.expected) > cents(b.expected)
          ? -1
          : 1,
    )
    .slice(0, 12);
}

// Expected values by current stage. These are forecasts, never counted as achievement.
export function PipelineSection({ report, detailed }: { report: Report; detailed: boolean }) {
  const { currency, pipeline: p } = report;
  return (
    <section aria-labelledby="pipeline-heading" className="mt-9 space-y-5">
      <div>
        <h2 id="pipeline-heading" className="text-2xl font-bold">
          Pipeline forecast
        </h2>
        <p className="mt-2 text-sm text-base-content/65">
          Current stages of opportunities expected to close in this period, filtered by owner and currency. Funding
          vertical has no pipeline mapping.
        </p>
      </div>
      <StatCards
        rows={[
          ["Expected pipeline value", money(p.expected, currency)],
          ["Opportunities in period", String(p.count)],
          ["Missing closing date", String(p.undated_count)],
          ["Undated expected value", money(p.undated_expected, currency)],
        ]}
      />
      <ReportBars
        title={p.stages.length > 12 ? "Top 12 stages by expected value" : "Expected value by current stage"}
        rows={topStages(p.stages).map(s => ({
          label: `${s.name}${s.is_provisional ? " (provisional)" : ""}`,
          value: s.expected,
          display: `${money(s.expected, currency)} · ${s.count} deals`,
        }))}
      />
      <div className="flex flex-wrap gap-3">
        {p.outcomes.map(o => (
          <div key={o.key} className="rounded-lg bg-base-200 px-4 py-3 text-sm">
            <span className="capitalize">{o.key}</span>: <strong>{o.count}</strong>
            <p className="mt-1 text-xs text-base-content/60">{money(o.expected, currency)} expected</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-base-content/60">
        Undated opportunities are excluded from period totals. Stage outcomes are current classifications; Won is not a
        receipt or automatic achievement.
      </p>
      {detailed && <StageTable stages={p.stages} currency={currency} />}
    </section>
  );
}

function StageTable({ stages, currency }: { stages: Stage[]; currency: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-base-300">
      <table className="table">
        <caption className="p-4 text-left font-semibold">All matching stages</caption>
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
                {s.is_provisional && <span className="ml-2 text-xs text-base-content/55">provisional</span>}
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
