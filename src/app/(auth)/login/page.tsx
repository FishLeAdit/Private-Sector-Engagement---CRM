import { redirect } from "next/navigation";
import { getAccess } from "@/lib/auth/access";
import { safeReturnPath } from "@/lib/auth/session";
import { currentTheme } from "@/lib/theme";
import { LoginForm } from "@/components/auth/login-form";
import { StatusPip, SysCode } from "@/components/ui/hud";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = safeReturnPath((await searchParams).next);
  const [access, theme] = await Promise.all([getAccess(), currentTheme()]);
  if (access.status === "allowed") redirect(next);
  if (access.status === "forbidden") redirect("/access-denied");
  const unavailable = access.status === "unavailable";
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="mb-4 flex w-full max-w-md justify-end">
        <ThemeToggle initial={theme} />
      </div>
      <section className="panel w-full max-w-md p-8" aria-labelledby="login-title">
        <div className="flex items-center justify-between gap-3">
          <SysCode>JAAGO.PSE // AUTH-01</SysCode>
          <StatusPip
            tone={unavailable ? "warning" : "nominal"}
            label={unavailable ? "Sign-in offline" : "Sign-in online"}
            blink
          />
        </div>
        <p className="hud-label mt-6">JAAGO Foundation</p>
        <h1 id="login-title" className="mt-2 font-mono text-2xl font-semibold">
          Sign in to PSE CRM
        </h1>
        <p className="mt-3 text-sm text-muted">Your Private Sector Engagement workspace.</p>
        {unavailable ? (
          <p className="mt-6 text-error" role="alert">
            Sign-in is temporarily unavailable. Please try again shortly or contact your administrator.
          </p>
        ) : (
          <LoginForm next={next} />
        )}
        <p className="mt-6 border-t border-base-300 pt-4 text-xs text-muted">
          Access is available to authorized PSE staff.
        </p>
      </section>
    </main>
  );
}
