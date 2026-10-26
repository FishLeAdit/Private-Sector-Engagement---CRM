import Link from "next/link";

export function ContactProblem({ message }: { message: string }) {
  return <section className="space-y-4 rounded-xl border border-base-300 bg-base-100 p-6" role="alert">
    <h1 className="text-xl font-semibold">Contacts could not be loaded</h1><p>{message}</p>
    <Link href="/contacts" className="btn btn-outline">Return to contacts</Link>
  </section>;
}
