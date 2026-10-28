"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "./account-menu";
import { Wordmark } from "./wordmark";

// Module codes are decorative; each link's accessible name is its label.
const sections = [
  { href: "/dashboard", label: "Dashboard", code: "OVR" },
  { href: "/contacts", label: "Contacts", code: "CON" },
  { href: "/opportunities", label: "Opportunities", code: "OPP" },
  { href: "/meetings", label: "Meetings", code: "MTG" },
  { href: "/activities", label: "Activities", code: "ACT" },
  { href: "/contributions", label: "Contributions", code: "RCV" },
  { href: "/targets", label: "Targets", code: "TGT" },
  { href: "/reports", label: "Reports", code: "RPT" },
];

// The navigation rail: always open from the lg breakpoint, behind a Menu button on smaller screens. The
// signed-in person sits at its foot, with Settings and Sign out behind their name.
export function ShellNav({ name, role }: { name: string; role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <aside className="border-b border-base-300 bg-base-200/70 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <Link href="/dashboard" className="block py-0.5">
          <Wordmark className="h-4 w-auto" />
        </Link>
        <button
          type="button"
          className="btn btn-ghost btn-sm font-mono text-xs uppercase lg:hidden"
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen(value => !value)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      <nav
        id="main-nav"
        aria-label="Main navigation"
        className={`${open ? "block" : "hidden"} pb-4 lg:block lg:flex-1`}
      >
        <ul>
          {sections.map(section => {
            const active = pathname === section.href || pathname.startsWith(`${section.href}/`);
            return (
              <li key={section.href}>
                <Link
                  href={section.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 border-l-2 px-5 py-2 text-sm transition-colors ${
                    active
                      ? "border-accent bg-base-300/40 text-base-content"
                      : "border-transparent text-muted hover:bg-base-300/30 hover:text-base-content"
                  }`}
                >
                  <span aria-hidden="true" className="w-8 text-[0.65rem] tracking-[0.15em] text-decor">
                    {section.code}
                  </span>
                  {section.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className={`${open ? "block" : "hidden"} lg:block`}>
        <AccountMenu name={name} role={role} onNavigate={() => setOpen(false)} />
      </div>
    </aside>
  );
}
