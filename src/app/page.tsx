import { redirect } from "next/navigation";
import { getAccess } from "@/lib/auth/access";

export default async function HomePage() {
  const access = await getAccess();
  redirect(access.status === "allowed" ? "/dashboard" : access.status === "forbidden" ? "/access-denied" : "/login");
}
