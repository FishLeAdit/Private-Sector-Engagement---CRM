import Link from "next/link";
export function FinanceProblem({ message }: { message: string }) {
  return (
    <section role="alert" className="space-y-4 rounded-xl border border-base-300 p-6">
      <h1 className="text-xl font-bold">Financial records could not be loaded</h1>
      <p>{message}</p>
      <Link href="/targets" className="btn btn-outline">
        Targets
      </Link>
      <Link href="/contributions" className="btn btn-ghost">
        Contributions
      </Link>
    </section>
  );
}
