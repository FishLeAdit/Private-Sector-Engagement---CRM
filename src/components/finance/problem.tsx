import { PageProblem } from "@/components/ui/page-problem";

export function FinanceProblem({ message }: { message: string }) {
  return (
    <PageProblem
      title="Financial records could not be loaded"
      message={message}
      links={[
        { href: "/targets", label: "Targets" },
        { href: "/contributions", label: "Contributions" },
      ]}
    />
  );
}
