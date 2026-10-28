import Link from "next/link";
import { requirePseUser } from "@/lib/auth/access";
import { isSuperadmin } from "@/lib/auth/roles";
import { PanelHeader, SysCode } from "@/components/ui/hud";

const sections = [
  {
    href: "/settings/pipeline",
    code: "CFG-01",
    title: "Pipeline",
    action: "Open pipeline settings",
    text: "Deal stages and contribution categories. Everyone can view them; an authorized manager changes them.",
  },
  {
    href: "/settings/odoo-import",
    code: "CFG-02",
    title: "Odoo import check",
    action: "Open the import check",
    text: "Check Odoo CSV exports against the CRM's rules, then import them once nothing needs review. Managers only.",
  },
  {
    href: "/settings/accounts",
    code: "CFG-03",
    title: "Accounts",
    action: "Manage accounts",
    text: "Create sign-in accounts, give staff, manager or superadmin access, restrict accounts and delete unused ones.",
    superadmin: true,
  },
];

export default async function SettingsPage() {
  const access = await requirePseUser();
  return (
    <>
      <SysCode className="mb-1 block">{"SYS.CFG // SETTINGS"}</SysCode>
      <h1 className="mb-3 text-3xl font-bold">Settings</h1>
      <p className="mb-7 text-muted">Team configuration and data migration tools.</p>
      <div className="grid max-w-4xl gap-5 md:grid-cols-2">
        {sections
          .filter(section => !section.superadmin || isSuperadmin(access.profile))
          .map(section => (
            <section key={section.href} className="flex flex-col panel p-5" aria-labelledby={section.code}>
              <PanelHeader id={section.code} title={section.title} code={section.code} />
              <p className="flex-1 text-sm text-muted">{section.text}</p>
              <Link href={section.href} className="btn btn-outline btn-sm mt-5 self-start">
                {section.action}
              </Link>
            </section>
          ))}
      </div>
    </>
  );
}
