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
  view: "dashboard" | "reports";
  filters: ReportFilters;
  report: Report;
  options: ReportOptions;
  quarters?: QuarterPoint[] | null;
};

// Dashboard and Reports share one layout for now; Reports adds a section index and full tables.
export function ReportView({ view, filters, report, options, quarters = null }: Props) {
  const query = new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)])).toString();
  const detailed = view === "reports";
  const sections: [string, string][] = [
    ["#fundraising", "01 Fundraising"],
    ["#pipeline", "02 Pipeline"],
    ["#workload", "03 Workload"],
    ...(report.engagement ? ([["#engagement", "04 Engagement"]] as [string, string][]) : []),
    ["#definitions", "05 Definitions"],
  ];
  return (
    <>
      <ReportHeader view={view} filters={filters} report={report} query={query} />
      <ReportFiltersForm key={query} path={`/${view}`} filters={filters} options={options} />
      {detailed && (
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
      )}
      <FundraisingSection
        report={report}
        monthly={filters.period.startsWith("m")}
        detailed={detailed}
        quarters={quarters}
      />
      <PipelineSection report={report} detailed={detailed} />
      <WorkloadSection report={report} detailed={detailed} />
      <EngagementSection report={report} detailed={detailed} />
      <ReportDefinitions report={report} />
    </>
  );
}
