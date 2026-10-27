import type { Report } from "@/features/reports/types";

// Plain-language metric definitions; docs/09-reporting-definitions.md holds the full version.
export function ReportDefinitions({ report }: { report: Report }) {
  return (
    <details className="mt-8 rounded-xl border border-base-300 p-5">
      <summary className="cursor-pointer font-semibold">How these figures are defined</summary>
      <div className="mt-4 space-y-3 text-sm leading-6 text-base-content/70">
        <p>
          Periods are calendar dates in Asia/Dhaka, from {report.start_date} inclusive to {report.end_date_exclusive}{" "}
          exclusive. Financial achievement uses the saved recognition time and explicit employee/vertical attribution.
          Year/quarter targets use stored baselines or allocation cells for the selection. Monthly targets are
          unavailable. Missing targets stay unavailable; zero allocations are not treated as missing.
        </p>
        <p>
          Pipeline figures are expected values and current outcomes for saved expected closing dates in the period. They
          do not reconstruct historical stages or add operational budgets to funding. Unvalued gifts and activity
          estimates never count as fundraising.
        </p>
        <p>
          Workload uses activity relevant time and meeting scheduled time; Done is the current saved status, not a
          separately recorded completion date. Independent activities have no contact, opportunity or meeting link.
          Undated and missing-context counts span all dates for the selected owner, as labeled.
        </p>
        <p>
          Contacts engaged uses a provisional definition awaiting PSE confirmation: distinct CRM contacts reached by
          Done meetings and Done activities in the period, as described under that section.
        </p>
        <p>
          Lead and follow-up-rate KPIs are awaiting approved definitions and are not calculated here; leads are shown
          only as the pipeline by stage. Existing record types and configurable labels are retained without declaring
          provisional stages or verticals final.
        </p>
      </div>
    </details>
  );
}
