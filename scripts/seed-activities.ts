// Administrative runner. Never import this file into the app or browser bundle.
import { z } from "zod";
import { createHostedDemoClient, requireResult, SeedError } from "./lib/hosted-demo";
import { chooseDemoOwner, demoContactIds, demoOpportunityIds } from "./lib/demo-data";
import { demoMeetingIds } from "./lib/demo-meetings";
import { buildDemoActivities, demoActivityIds } from "./lib/demo-activities";
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) { console.log("npm.cmd run seed:activities -- [--apply] [--owner=EXISTING_PSE_PROFILE_UUID]\nDefault: read-only preview. Inserts missing fictional activities only; existing work and parent records are preserved."); return; }
  if (args.some(arg => arg !== "--apply" && !arg.startsWith("--owner="))) throw new SeedError("Unknown option. Use --help.");
  const requestedOwner = args.find(arg => arg.startsWith("--owner="))?.slice(8);
  if (requestedOwner && !z.uuid().safeParse(requestedOwner).success) throw new SeedError("--owner must be an existing active PSE profile UUID.");
  const client = createHostedDemoClient();
  const [profiles, contacts, opportunities, meetings, activities] = await Promise.all([
    client.from("profiles").select("id,display_name,department,role,active").eq("department", "PSE").eq("active", true).in("role", ["pse_member", "pse_manager", "admin"]).order("created_at").order("id").limit(1000),
    client.from("contacts").select("id,kind").in("id", demoContactIds).order("id"),
    client.from("opportunities").select("id,contact_id,primary_contact_id,secondary_contact_id").in("id", demoOpportunityIds).order("id"),
    client.from("meetings").select("id,contact_id,opportunity_id,status").in("id", demoMeetingIds).order("id"),
    client.from("activities").select("id").in("id", demoActivityIds),
  ]);
  const owner = chooseDemoOwner(requireResult(profiles, "Read active PSE owners"), requestedOwner);
  const rows = buildDemoActivities(owner.id, requireResult(contacts, "Read demo contacts"), requireResult(opportunities, "Read demo opportunities"), requireResult(meetings, "Read demo meetings"));
  const existing = requireResult(activities, "Read demo activities"), ids = new Set(existing.map(row => row.id)), missing = rows.filter(row => !ids.has(row.id!));
  console.log(JSON.stringify({ mode: args.includes("--apply") ? "apply" : "preview", owner: owner.display_name, addActivities: missing.length, existingDemoActivities: existing.length }, null, 2));
  if (!args.includes("--apply")) { console.log("Read-only preview. Use npm.cmd run seed:activities -- --apply to insert missing rows."); return; }
  if (missing.length) requireResult(await client.from("activities").upsert(missing, { onConflict: "id", ignoreDuplicates: true, defaultToNull: false }).select("id"), "Insert demo activities");
  const saved = requireResult(await client.from("activities").select("id,activity_type,status,contact_id,opportunity_id,meeting_id,contact:contact_id(id),opportunity:opportunity_id(id),meeting:meeting_id(id)").in("id", demoActivityIds), "Verify hosted activities and links");
  if (saved.length !== 11 || saved.some(row => (row.contact_id && !row.contact) || (row.opportunity_id && !row.opportunity) || (row.meeting_id && !row.meeting))) throw new SeedError("Activity verification is incomplete. Existing records are preserved; rerun to add missing rows.");
  console.log(JSON.stringify({ verifiedActivities: saved.length, types: saved.map(row => row.activity_type), independentActivities: saved.filter(row => !row.contact_id && !row.opportunity_id && !row.meeting_id).length }, null, 2));
  console.log("Hosted activities verified. Refresh Activities and search Demo |. No contacts, opportunities, meetings, targets or recognized contributions were created/changed.");
}
main().catch(error => { console.error(error instanceof SeedError || (error instanceof Error && /active PSE/.test(error.message)) ? error.message : "Activity seed failed. Check private configuration and retry; existing records are preserved."); process.exitCode = 1; });
