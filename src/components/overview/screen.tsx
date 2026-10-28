import { overviewData } from "@/features/overview/context";
import { PageProblem } from "@/components/ui/page-problem";
import { OverviewView } from "./overview-view";

export async function OverviewScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const result = await overviewData(await searchParams);
  if (!result.ok) {
    const signedOut = result.error.status === 401;
    return (
      <PageProblem
        title="Dashboard could not be loaded"
        message={result.error.message}
        links={[
          signedOut
            ? { href: "/login", label: "Sign in again" }
            : { href: "/dashboard", label: "Reset filters and retry" },
        ]}
      />
    );
  }
  return <OverviewView data={result.data} />;
}
