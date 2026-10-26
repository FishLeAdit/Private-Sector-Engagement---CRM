import { redirect } from "next/navigation";
import { getAccess } from "@/lib/auth/access";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function AccessDeniedPage() {
  const access = await getAccess();
  if (access.status === "anonymous") redirect("/login");
  if (access.status === "allowed") redirect("/dashboard");
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6">
    <h1 className="text-3xl font-bold">{access.status === "forbidden" ? "PSE access required" : "Access could not be verified"}</h1>
    <p>{access.status === "forbidden"
      ? "Your account does not have active PSE access. Contact your administrator or sign out to use another account."
      : "Sign-in services are temporarily unavailable. Please try again shortly."}</p>
    <LogoutButton />
  </main>;
}
