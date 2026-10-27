import { PageProblem } from "@/components/ui/page-problem";

export function ActivityProblem({ message }: { message: string }) {
  return (
    <PageProblem
      title="Activities could not be loaded"
      message={message}
      links={[{ href: "/activities", label: "Return to activities" }]}
    />
  );
}
