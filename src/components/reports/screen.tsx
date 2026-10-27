import { PageProblem } from "@/components/ui/page-problem";
import { reportsPage, reportData } from "@/features/reports/context";
import { ReportView } from "./view";
export async function ReportScreen({
  view,
  searchParams,
}: {
  view: "dashboard" | "reports";
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = await searchParams;
  const result = await reportData(async () => {
    const service = await reportsPage();
    return Promise.all([service.read(filters), service.options()]);
  });
  if (!result.ok) {
    const signedOut = result.error.status === 401;
    return (
      <PageProblem
        title={`${view === "dashboard" ? "Dashboard" : "Reports"} could not be loaded`}
        message={result.error.message}
        links={[
          signedOut
            ? { href: "/login", label: "Sign in again" }
            : { href: `/${view}`, label: "Reset filters and retry" },
        ]}
      />
    );
  }
  const [{ filters: input, report }, options] = result.data;
  return <ReportView view={view} filters={input} report={report} options={options} />;
}
