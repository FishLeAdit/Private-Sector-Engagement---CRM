import Link from "next/link";

const sections = ["dashboard", "contacts", "opportunities", "meetings", "activities", "targets", "reports", "settings"];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // TODO: Enforce verified PSE access before rendering CRM data.
  return <div className="min-h-screen lg:flex"><aside className="bg-base-200 p-6 lg:w-64"><h2 className="text-xl font-bold">PSE CRM</h2><nav aria-label="Main navigation"><ul className="menu">{sections.map(section => <li key={section}><Link className="capitalize" href={`/${section}`}>{section}</Link></li>)}</ul></nav></aside><main className="flex-1 p-8">{children}</main></div>;
}
