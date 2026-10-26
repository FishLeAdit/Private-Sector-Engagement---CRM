import Link from "next/link";
import { requirePseUser } from "@/lib/auth/access";
import { roleLabels } from "@/lib/auth/roles";
import { LogoutButton } from "@/components/auth/logout-button";

const sections = ["dashboard", "contacts", "opportunities", "meetings", "activities", "targets", "reports", "settings"];

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requirePseUser();
  return <div className="min-h-screen lg:flex">
    <aside className="border-base-300 bg-base-200 p-6 lg:w-64 lg:shrink-0 lg:border-r">
      <Link href="/dashboard" className="text-xl font-bold">PSE CRM</Link>
      <nav aria-label="Main navigation"><ul className="menu mt-4 w-full p-0">{sections.map(section => <li key={section}><Link className="capitalize" href={`/${section}`}>{section}</Link></li>)}</ul></nav>
    </aside>
    <div className="min-w-0 flex-1">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-base-300 px-6 py-4">
        <div><p className="font-medium">{profile.display_name}</p><p className="text-sm text-base-content/60">{roleLabels[profile.role]}</p></div>
        <LogoutButton />
      </header>
      <main className="p-6 lg:p-8">{children}</main>
    </div>
  </div>;
}
