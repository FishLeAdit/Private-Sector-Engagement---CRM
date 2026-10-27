import { PageProblem } from "@/components/ui/page-problem";

export function ContactProblem({ message }: { message: string }) {
  return (
    <PageProblem
      title="Contacts could not be loaded"
      message={message}
      links={[{ href: "/contacts", label: "Return to contacts" }]}
    />
  );
}
