import Link from "next/link";
import { opportunityPageContext, opportunityPageData } from "@/features/opportunities/context";
import { isPseManager } from "@/lib/auth/roles";
import { PipelineSettings } from "@/components/opportunities/pipeline-settings";
import { OpportunityProblem } from "@/components/opportunities/opportunity-state";
import { SysCode } from "@/components/ui/hud";
export default async function PipelineSettingsPage() {
  const { service, access } = await opportunityPageContext();
  const result = await opportunityPageData(() => service.options());
  if (!result.ok) return <OpportunityProblem message={result.error.message} />;
  return (
    <>
      <Link href="/settings" className="link text-sm">
        ← Settings
      </Link>
      <SysCode className="mt-4 mb-1 block">{"SYS.CFG // PIPELINE"}</SysCode>
      <h1 className="mb-3 text-3xl font-bold">Pipeline settings</h1>
      <p className="mb-7 text-base-content/65">Stages and contribution categories for the PSE team.</p>
      <PipelineSettings initial={result.data} manager={isPseManager(access.profile)} />
    </>
  );
}
