import Link from "next/link";
export function OpportunityProblem({ message }: { message: string }) {
  return <section role="alert" className="space-y-4 rounded-lg border border-base-300 p-6"><h1 className="text-xl font-bold">Opportunities could not be loaded</h1><p>{message}</p><Link href="/opportunities" className="btn btn-outline">Return to opportunities</Link></section>;
}
export function PipelineSetupNeeded() {
  return <section className="space-y-3 rounded-lg border border-warning bg-warning/10 p-6"><h2 className="text-xl font-semibold">Configure your pipeline first</h2><p>A manager needs to add at least one active stage and contribution category. The final pipeline labels still need PSE confirmation.</p><Link href="/settings" className="btn btn-outline">Pipeline settings</Link></section>;
}
