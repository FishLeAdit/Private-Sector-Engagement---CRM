import { redirect } from "next/navigation";

export default function HomePage() {
  // TODO: Redirect by verified authentication state when Supabase Auth is implemented.
  redirect("/login");
}
