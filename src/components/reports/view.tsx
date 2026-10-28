import type { QuarterPoint } from "@/features/reports/quarters";
import type { Report, ReportOptions } from "@/features/reports/types";
import type { ReportFilters } from "@/features/reports/schemas";
import { ReportDefinitions } from "./definitions";
import { EngagementSection } from "./engagement-section";
import { ReportFiltersForm } from "./filters";
import { FundraisingSection } from "./fundraising-section";
import { ReportHeader } from "./header";
import { PipelineSection } from "./pipeline-section";
import { WorkloadSection } from "./workload-section";

type Props = {
  filters: ReportFilters;
  report: Report;
  options: ReportOptions;
  quarters?: QuarterPoint[] | null;
};

// The detailed Reports page: filters, a section index, then each section's charts and full tables.
export function ReportView({ filters, report, options, quarters = null }: Props) {
  const query = new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)])).toString();
  const sections: [string, string][] = [
    ["#fundraising", "01 Fundraising"],
    ["#pipeline", "02 Pipeline"],
    ["#workload", "03 Workload"],
    ...(report.engagement ? ([["#engagement", "04 Engagement"]] as [string, string][]) : []),
    ["#definitions", "05 Definitions"],
  ];
  return (
    <>
      <ReportHeader filters={filters} report={report} />
      <ReportFiltersForm key={query} path="/reports" filters={filters} options={options} />
      <nav
        aria-label="Report sections"
        className="sticky top-0 z-10 mb-6 flex flex-wrap gap-x-5 gap-y-1 border-y border-base-300 bg-base-100/90 py-2 font-mono text-xs uppercase tracking-wider backdrop-blur"
      >
        {sections.map(([href, label]) => (
          <a key={href} href={href} className="text-muted hover:text-base-content">
            {label}
          </a>
        ))}
      </nav>
      <FundraisingSection report={report} monthly={filters.period.startsWith("m")} detailed quarters={quarters} />
      <PipelineSection report={report} detailed />
      <WorkloadSection report={report} detailed />
      <EngagementSection report={report} detailed />
      <ReportDefinitions report={report} />
    </>
  );
}
