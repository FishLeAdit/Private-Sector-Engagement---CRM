import Link from "next/link";
import { PageProblem } from "@/components/ui/page-problem";

export function OpportunityProblem({ message }: { message: string }) {
  return (
    <PageProblem
      title="Opportunities could not be loaded"
      message={message}
      links={[{ href: "/opportunities", label: "Return to opportunities" }]}
    />
  );
}

export function PipelineSetupNeeded() {
  return (
    <section className="space-y-3 border-l-2 border-warning bg-warning/5 p-6">
      <h2 className="text-xl font-semibold">Configure your pipeline first</h2>
      <p>
        A manager needs to add at least one active stage and contribution category. The final pipeline labels still need
        PSE confirmation.
      </p>
      <Link href="/settings/pipeline" className="btn btn-outline">
        Pipeline settings
      </Link>
    </section>
  );
}
