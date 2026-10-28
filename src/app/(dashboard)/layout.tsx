import { requirePseUser } from "@/lib/auth/access";
import { roleLabels } from "@/lib/auth/roles";
import { currentTheme } from "@/lib/theme";
import { LogoutButton } from "@/components/auth/logout-button";
import { ShellNav } from "@/components/shell/nav";
import { StatusPip, SysCode } from "@/components/ui/hud";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [{ profile }, theme] = await Promise.all([requirePseUser(), currentTheme()]);
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <ShellNav />
      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-base-300 bg-base-100/80 px-6 py-3 backdrop-blur">
          <div className="min-w-0">
            <SysCode className="hidden sm:block">JAAGO.PSE // OPS</SysCode>
            <p className="font-mono text-sm sm:mt-1">
              {profile.display_name} <span className="text-muted">· {roleLabels[profile.role]}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="hidden sm:inline-flex">
              <StatusPip tone="nominal" label="Session active" blink />
            </span>
            <ThemeToggle initial={theme} />
            <LogoutButton />
          </div>
        </header>
        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
