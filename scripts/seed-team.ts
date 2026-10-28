// Administrative fictional seed of records owned by the named demo staff; no application/browser imports.
// npm.cmd run seed:team -- [--apply]. Default: read-only preview. Run seed:accounts first.
import { createHostedDemoClient, requireResult, SeedError } from "./lib/hosted-demo";
import { checkDemoContacts } from "./lib/demo-data";
import { buildTeamData, teamIds, teamNames } from "./lib/demo-team";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(
      "npm.cmd run seed:team -- [--apply]\nDefault: read-only preview. Inserts only missing fictional contacts, deals, meetings and activities owned by the named demo staff; existing rows are never changed. No contributions are recorded.",
    );
    return;
  }
  if (args.some(arg => arg !== "--apply")) throw new SeedError("Unknown option. Use --help for supported arguments.");
  const client = createHostedDemoClient();
  const [profiles, stages, categories, contacts] = await Promise.all([
    client.from("profiles").select("id,display_name,department,role,active").eq("department", "PSE").eq("active", true),
    client.from("pipeline_stages").select("id,name,active"),
    client.from("contribution_categories").select("id,code,active"),
    client.from("contacts").select("id,email_normalized,phone_normalized").limit(10000),
  ]);
  const people = requireResult(profiles, "Read PSE profiles");
  const staff = {} as Record<(typeof teamNames)[number], string>;
  for (const name of teamNames) {
    const found = people.filter(p => p.display_name === name);
    if (found.length !== 1)
      throw new SeedError(
        `Expected one active PSE profile named "${name}". Run npm.cmd run seed:accounts -- --apply first.`,
      );
    staff[name] = found[0].id;
  }
  let data: ReturnType<typeof buildTeamData>;
  try {
    data = buildTeamData(staff, requireResult(stages, "Read stages"), requireResult(categories, "Read categories"));
    checkDemoContacts([...data.companies, ...data.people], requireResult(contacts, "Read contacts"));
  } catch (error) {
    throw error instanceof SeedError ? error : new SeedError((error as Error).message);
  }
  const existing = async (table: "contacts" | "opportunities" | "meetings" | "activities", ids: string[]) =>
    new Set(requireResult(await client.from(table).select("id").in("id", ids), `Read ${table}`).map(row => row.id));
  const have = {
    contacts: await existing("contacts", teamIds.contacts),
    deals: await existing("opportunities", teamIds.deals),
    meetings: await existing("meetings", teamIds.meetings),
    activities: await existing("activities", teamIds.activities),
  };
  const missing = {
    companies: data.companies.filter(row => !have.contacts.has(row.id!)),
    people: data.people.filter(row => !have.contacts.has(row.id!)),
    deals: data.deals.filter(row => !have.deals.has(row.id!)),
    meetings: data.meetings.filter(row => !have.meetings.has(row.id!)),
    activities: data.activities.filter(row => !have.activities.has(row.id!)),
  };
  for (const [kind, rows] of Object.entries(missing)) console.log(`- ${kind}: ${rows.length} to insert`);
  if (!args.includes("--apply")) {
    console.log("Preview only. Rerun with -- --apply to insert the missing rows.");
    return;
  }
  // Parents first: companies, then their people, deals, meetings and finally activities.
  if (missing.companies.length)
    requireResult(await client.from("contacts").insert(missing.companies).select("id"), "Insert companies");
  if (missing.people.length)
    requireResult(await client.from("contacts").insert(missing.people).select("id"), "Insert people");
  if (missing.deals.length)
    requireResult(await client.from("opportunities").insert(missing.deals).select("id"), "Insert deals");
  if (missing.meetings.length)
    requireResult(await client.from("meetings").insert(missing.meetings).select("id"), "Insert meetings");
  if (missing.activities.length)
    requireResult(await client.from("activities").insert(missing.activities).select("id"), "Insert activities");
  console.log("Done.");
}

main().catch(error => {
  console.error(error instanceof SeedError ? error.message : "The team seed failed unexpectedly.");
  process.exitCode = 1;
});
