import { redirect } from "next/navigation";
import { getAccess } from "@/lib/auth/access";
import { safeReturnPath } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = safeReturnPath((await searchParams).next);
  const access = await getAccess();
  if (access.status === "allowed") redirect(next);
  if (access.status === "forbidden") redirect("/access-denied");
  return <main className="flex min-h-screen items-center justify-center bg-base-200 px-6 py-12">
    <section className="w-full max-w-md rounded-2xl border border-base-300 bg-base-100 p-8 shadow-sm" aria-labelledby="login-title">
      <p className="text-sm font-semibold tracking-widest text-primary">JAAGO FOUNDATION</p>
      <h1 id="login-title" className="mt-3 text-3xl font-bold">Sign in to PSE CRM</h1>
      <p className="mt-3 text-base-content/70">Your Private Sector Engagement workspace.</p>
      {access.status === "unavailable"
        ? <p className="mt-6 text-error" role="alert">Sign-in is temporarily unavailable. Please try again shortly or contact your administrator.</p>
        : <LoginForm next={next} />}
      <p className="mt-6 text-sm text-base-content/60">Access is available to authorized PSE staff.</p>
    </section>
  </main>;
}
