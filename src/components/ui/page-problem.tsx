import Link from "next/link";

type Props = { title: string; message: string; links: { href: string; label: string }[] };

// Shown in place of a page when its data could not be loaded or the request was invalid.
export function PageProblem({ title, message, links }: Props) {
  return (
    <section role="alert" className="space-y-4 rounded-xl border border-base-300 bg-base-100 p-6">
      <h1 className="text-xl font-bold">{title}</h1>
      <p>{message}</p>
      <div className="flex flex-wrap gap-2">
        {links.map(link => (
          <Link key={link.href} href={link.href} className="btn btn-outline">
            {link.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
