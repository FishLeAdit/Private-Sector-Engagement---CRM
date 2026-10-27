import Link from "next/link";
import { opportunityPageContext, opportunityPageData } from "@/features/opportunities/context";
import { isPseManager } from "@/lib/auth/roles";
import { OpportunityForm } from "@/components/opportunities/opportunity-form";
import { OpportunityProblem, PipelineSetupNeeded } from "@/components/opportunities/opportunity-state";
export default async function NewOpportunityPage() {
  const { access, service } = await opportunityPageContext();
  const result = await opportunityPageData(() => service.options());
  if (!result.ok) return <OpportunityProblem message={result.error.message} />;
  const options = result.data;
  return (
    <>
      <Link href="/opportunities" className="link text-sm">
        ← Opportunities
      </Link>
      <h1 className="mb-7 mt-4 text-3xl font-bold">New deal</h1>
      {options.stages.some(row => row.active) && options.categories.some(row => row.active) ? (
        <OpportunityForm options={options} userId={access.userId} manager={isPseManager(access.profile)} />
      ) : (
        <PipelineSetupNeeded />
      )}
    </>
  );
}
