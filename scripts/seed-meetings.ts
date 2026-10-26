// Administrative fictional meeting seed; no application/browser imports of this runner.
import { z } from "zod";
import { createHostedDemoClient, requireResult, SeedError } from "./lib/hosted-demo";
import { chooseDemoOwner, demoContactIds, demoOpportunityIds } from "./lib/demo-data";
import { buildDemoMeetings, demoMeetingIds } from "./lib/demo-meetings";
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) { console.log("npm.cmd run seed:meetings -- [--apply] [--owner=EXISTING_PSE_PROFILE_UUID]\nDefault: read-only preview. Only missing fictional meetings are inserted; parent records are never recreated or overwritten."); return; }
  if (args.some(arg => arg !== "--apply" && !arg.startsWith("--owner="))) throw new SeedError("Unknown option. Use --help for supported arguments.");
  const requestedOwner = args.find(arg => arg.startsWith("--owner="))?.slice(8);
  if (requestedOwner && !z.uuid().safeParse(requestedOwner).success) throw new SeedError("--owner must be an existing active PSE profile UUID.");
  const client = createHostedDemoClient();
  const [profileResponse, contactResponse, opportunityResponse, meetingResponse] = await Promise.all([
    client.from("profiles").select("id,display_name,department,role,active").eq("department", "PSE").eq("active", true).in("role", ["pse_member", "pse_manager", "admin"]).order("created_at").order("id").limit(1000),
    client.from("contacts").select("id,kind").in("id", demoContactIds).order("id"),
    client.from("opportunities").select("id,contact_id,primary_contact_id,secondary_contact_id").in("id", demoOpportunityIds).order("id"),
    client.from("meetings").select("id").in("id", demoMeetingIds),
  ]);
  const owner = chooseDemoOwner(requireResult(profileResponse, "Read PSE owners"), requestedOwner);
  const rows = buildDemoMeetings(owner.id, requireResult(contactResponse, "Read demo contacts"), requireResult(opportunityResponse, "Read demo opportunities"));
  const existing = requireResult(meetingResponse, "Read demo meetings"), ids = new Set(existing.map(row => row.id)), missing = rows.filter(row => !ids.has(row.id!));
  console.log(JSON.stringify({ mode: args.includes("--apply") ? "apply" : "preview", owner: owner.display_name, addMeetings: missing.length, existingDemoMeetings: existing.length }, null, 2));
  if (!args.includes("--apply")) { console.log("Read-only preview. Use npm.cmd run seed:meetings -- --apply to add missing meetings."); return; }
  if (missing.length) requireResult(await client.from("meetings").upsert(missing, { onConflict: "id", ignoreDuplicates: true, defaultToNull: false }).select("id"), "Insert demo meetings");
  const saved = requireResult(await client.from("meetings").select("id,status,scheduled_at,contact:contact_id(id,name,designation),opportunity:opportunity_id(id,deal_name)").in("id", demoMeetingIds), "Verify hosted meetings and relationships");
  if (saved.length !== 6 || saved.some(row => !row.contact && !row.opportunity)) throw new SeedError("Meeting verification is incomplete. Rerun to add any missing rows; existing rows are preserved.");
  console.log(JSON.stringify({ verifiedMeetings: saved.length, statuses: saved.reduce<Record<string, number>>((counts, row) => { counts[row.status] = (counts[row.status] ?? 0) + 1; return counts; }, {}) }, null, 2));
  console.log("Hosted demo meetings verified. Refresh Meetings or search Demo |. No contacts, opportunities, follow-ups, targets or actual contributions were created/changed.");
}
main().catch(error => { console.error(error instanceof SeedError || (error instanceof Error && /active PSE|Existing demo contacts/.test(error.message)) ? error.message : "Meeting seed failed. Check private configuration and retry; existing records are preserved."); process.exitCode = 1; });
