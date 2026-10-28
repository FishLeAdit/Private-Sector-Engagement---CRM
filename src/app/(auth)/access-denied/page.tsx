import { redirect } from "next/navigation";
import { getAccess } from "@/lib/auth/access";
import { LogoutButton } from "@/components/auth/logout-button";
import { StatusPip, SysCode } from "@/components/ui/hud";

export default async function AccessDeniedPage() {
  const access = await getAccess();
  if (access.status === "anonymous") redirect("/login");
  if (access.status === "allowed") redirect("/dashboard");
  const forbidden = access.status === "forbidden";
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="panel w-full max-w-lg space-y-5 p-8" aria-labelledby="denied-title">
        <div className="flex items-center justify-between gap-3">
          <SysCode>JAAGO.PSE // AUTH-02</SysCode>
          <StatusPip
            tone={forbidden ? "critical" : "warning"}
            label={forbidden ? "Access denied" : "Verification offline"}
          />
        </div>
        <h1 id="denied-title" className="font-mono text-2xl font-semibold">
          {forbidden ? "PSE access required" : "Access could not be verified"}
        </h1>
        <p className="text-sm text-muted">
          {forbidden
            ? "Your account does not have active PSE access. Contact your administrator or sign out to use another account."
            : "Sign-in services are temporarily unavailable. Please try again shortly."}
        </p>
        <LogoutButton />
      </section>
    </main>
  );
}
