import Link from "next/link";
import { financeData } from "@/features/finance/context";
import { targetPage } from "@/features/targets/context";
import { FinanceProblem } from "@/components/finance/problem";
import { TargetForm } from "@/components/targets/target-form";
import { isPseManager } from "@/lib/auth/roles";
import { toDhakaDateTimeInput } from "@/lib/dates";
import { SysCode } from "@/components/ui/hud";
export default async function Page() {
  const { service, access } = await targetPage();
  if (!isPseManager(access.profile))
    return <FinanceProblem message="Only an authorized manager can create target plans." />;
  const result = await financeData(() => service.options());
  if (!result.ok) return <FinanceProblem message={result.error.message} />;
  return (
    <>
      <Link href="/targets" className="link text-sm">
        ← Targets
      </Link>
      <SysCode className="mt-4 mb-1 block">{"SYS.TGT // NEW"}</SysCode>
      <h1 className="mb-6 text-3xl font-bold">New target plan</h1>
      <TargetForm options={result.data} year={Number(toDhakaDateTimeInput(new Date().toISOString()).slice(0, 4))} />
    </>
  );
}
