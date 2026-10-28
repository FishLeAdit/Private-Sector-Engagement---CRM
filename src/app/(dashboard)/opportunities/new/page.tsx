import Link from "next/link";
import { opportunityPageContext, opportunityPageData } from "@/features/opportunities/context";
import { isPseManager } from "@/lib/auth/roles";
import { OpportunityForm } from "@/components/opportunities/opportunity-form";
import { OpportunityProblem, PipelineSetupNeeded } from "@/components/opportunities/opportunity-state";
import { SysCode } from "@/components/ui/hud";
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
      <SysCode className="mt-4 mb-1 block">{"SYS.OPP // NEW"}</SysCode>
      <h1 className="mb-7 text-3xl font-bold">New deal</h1>
      {options.stages.some(row => row.active) && options.categories.some(row => row.active) ? (
        <OpportunityForm options={options} userId={access.userId} manager={isPseManager(access.profile)} />
      ) : (
        <PipelineSetupNeeded />
      )}
    </>
  );
}
