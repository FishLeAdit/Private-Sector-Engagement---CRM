import { PageProblem } from "@/components/ui/page-problem";

export function MeetingProblem({ message }: { message: string }) {
  return (
    <PageProblem
      title="Meetings could not be loaded"
      message={message}
      links={[{ href: "/meetings", label: "Return to meetings" }]}
    />
  );
}
