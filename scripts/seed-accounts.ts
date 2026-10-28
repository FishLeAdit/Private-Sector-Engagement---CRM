// Administrative fictional account seed; no application/browser imports of this runner.
// npm.cmd run seed:accounts -- [--superadmin=EMAIL] [--apply]. Default: read-only preview.
import { randomBytes } from "node:crypto";
import { createHostedDemoClient, requireResult, SeedError } from "./lib/hosted-demo";
import { planAccounts, SUPERADMIN_NAME, type AccountStep } from "./lib/demo-accounts";

const describe = (step: AccountStep) =>
  ({
    promote: () =>
      step.kind === "promote" &&
      `Make ${step.email} the superadmin${step.rename ? ` and rename it "${SUPERADMIN_NAME}"` : ""}`,
    keep: () => step.kind === "keep" && `Keep the existing "${step.name}"`,
    adopt: () => step.kind === "adopt" && `Rename "${step.from}" to "${step.name}" (${step.role}), keeping its sign-in`,
    create: () => step.kind === "create" && `Create ${step.email} as "${step.name}" (${step.role})`,
  })[step.kind]();

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(
      "npm.cmd run seed:accounts -- [--superadmin=EMAIL] [--apply]\nDefault: read-only preview. Renames the generic demo profiles to fictional named staff, creates any that are missing, and optionally makes one existing account the superadmin. New sign-ins get a random password that is not shown; set one in Settings → Accounts.",
    );
    return;
  }
  if (args.some(arg => arg !== "--apply" && !arg.startsWith("--superadmin=")))
    throw new SeedError("Unknown option. Use --help for supported arguments.");
  const superadmin = args.find(arg => arg.startsWith("--superadmin="))?.slice(13);
  const client = createHostedDemoClient();
  const profiles = requireResult(
    await client.from("profiles").select("id,display_name,department,role,active").order("created_at").order("id"),
    "Read profiles",
  );
  const emails = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new SeedError("Reading sign-in accounts failed. Check the service role key.");
    for (const user of data.users) emails.set(user.id, user.email ?? "");
    if (data.users.length < 1000) break;
  }
  let steps: AccountStep[];
  try {
    steps = planAccounts(profiles, emails, superadmin);
  } catch (error) {
    throw new SeedError((error as Error).message);
  }
  for (const step of steps) console.log(`- ${describe(step)}`);
  if (!args.includes("--apply")) {
    console.log("Preview only. Rerun with -- --apply to make these changes.");
    return;
  }
  for (const step of steps) {
    if (step.kind === "promote")
      requireResult(
        await client
          .from("profiles")
          .update({ role: "admin", ...(step.rename ? { display_name: SUPERADMIN_NAME } : {}) })
          .eq("id", step.id)
          .select("id")
          .single(),
        "Promote the superadmin",
      );
    if (step.kind === "adopt")
      requireResult(
        await client
          .from("profiles")
          .update({ display_name: step.name, role: step.role })
          .eq("id", step.id)
          .select("id")
          .single(),
        `Rename ${step.from}`,
      );
    if (step.kind === "create") {
      const { data, error } = await client.auth.admin.createUser({
        email: step.email,
        password: randomBytes(18).toString("base64url"),
        email_confirm: true,
      });
      if (error || !data.user) throw new SeedError(`Creating the sign-in for ${step.email} failed.`);
      const created = await client
        .from("profiles")
        .insert({ id: data.user.id, display_name: step.name, department: "PSE", role: step.role, active: true })
        .select("id")
        .single();
      if (created.error) await client.auth.admin.deleteUser(data.user.id);
      requireResult(created, `Create the profile for ${step.name}`);
    }
  }
  console.log("Done. Set passwords for the new accounts in Settings → Accounts before signing in as them.");
}

main().catch(error => {
  console.error(error instanceof SeedError ? error.message : "The account seed failed unexpectedly.");
  process.exitCode = 1;
});
