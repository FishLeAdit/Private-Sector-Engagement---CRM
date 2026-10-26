// Explicit administrative CLI only. Never import into application/browser code.
import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "../src/types/database.types";
import { buildDemoData, checkDemoContacts, chooseDemoOwner, demoContactIds, demoLookupRows, demoOpportunityIds } from "./lib/demo-data";

class SeedError extends Error {}
function requireResult<T>({ data, error, status }: { data: T; error: { code?: string; message?: string } | null; status?: number }, action: string): NonNullable<T> {
  if (error) {
    const reason = error.code || (/invalid.*key|invalid.*jwt/i.test(error.message ?? "") ? "invalid API key" : /fetch failed|network/i.test(error.message ?? "") ? "network connection failed" : "provider error");
    throw new SeedError(`${action} failed (${reason}${status ? `, HTTP ${status}` : ""}). No raw provider details or credentials are displayed. Refresh and rerun after resolving the issue.`);
  }
  if (data == null) throw new SeedError(`${action} returned no result.`);
  return data;
}
async function readConfiguration(client: SupabaseClient<Database>) {
  const [stageResponse, categoryResponse] = await Promise.all([
    client.from("pipeline_stages").select("*").order("position").limit(1000),
    client.from("contribution_categories").select("*").order("code").limit(1000),
  ]);
  return { stages: requireResult(stageResponse, "Read stages"), categories: requireResult(categoryResponse, "Read categories") };
}
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) { console.log("npm run seed:demo -- [--apply] [--owner=EXISTING_PSE_PROFILE_UUID]\nDefault: read-only preview. --apply adds missing fictional demo records to the configured Supabase project."); return; }
  if (args.some(arg => arg !== "--apply" && !arg.startsWith("--owner="))) throw new SeedError("Unknown option. Use --help for the supported arguments.");
  const requestedOwner = args.find(arg => arg.startsWith("--owner="))?.slice(8);
  if (requestedOwner && !z.uuid().safeParse(requestedOwner).success) throw new SeedError("--owner must be an existing active PSE profile UUID.");
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new SeedError("Configure NEXT_PUBLIC_SUPABASE_URL and the server-only SUPABASE_SERVICE_ROLE_KEY privately in .env.local. Never paste the key into chat or commit it.");
  let serviceRole = key.startsWith("sb_secret_");
  if (key.startsWith("eyJ")) {
    try { serviceRole = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8")).role === "service_role"; } catch { /* Reject malformed private configuration below. */ }
  }
  if (!serviceRole || /your-|placeholder/i.test(key)) throw new SeedError("SUPABASE_SERVICE_ROLE_KEY is still a placeholder or is not a server-side secret/service_role key. Replace it privately in .env.local; do not paste it into chat.");
  const parsed = new URL(url);
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new SeedError("The configured Supabase URL is invalid.");
  const client = createClient<Database>(parsed.origin, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const [profileResponse, configured] = await Promise.all([
    client.from("profiles").select("id,display_name,department,role,active").eq("department", "PSE").eq("active", true).in("role", ["pse_member", "pse_manager", "admin"]).order("created_at").order("id").limit(1000),
    readConfiguration(client),
  ]);
  const owner = chooseDemoOwner(requireResult(profileResponse, "Read existing PSE profiles"), requestedOwner);
  const examples = demoLookupRows();
  const stagesToAdd = configured.stages.length ? [] : examples.stages;
  const categoriesToAdd = configured.categories.length ? [] : examples.categories;
  const data = buildDemoData(owner.id, configured.stages.length ? configured.stages : examples.stages, configured.categories.length ? configured.categories : examples.categories);
  const contacts = [...data.companies, ...data.people];
  const emails = contacts.flatMap(row => row.email ? [row.email.toLowerCase()] : []), phones = contacts.flatMap(row => row.phone ? [row.phone.replace(/[^0-9]/g, "")] : []);
  const [contactResponse, opportunityResponse, emailResponse, phoneResponse] = await Promise.all([
    client.from("contacts").select("id,email_normalized,phone_normalized").in("id", demoContactIds),
    client.from("opportunities").select("id").in("id", demoOpportunityIds),
    client.from("contacts").select("id,email_normalized,phone_normalized").in("email_normalized", emails),
    client.from("contacts").select("id,email_normalized,phone_normalized").in("phone_normalized", phones),
  ]);
  const existingContacts = requireResult(contactResponse, "Read demo contacts"), existingOpportunities = requireResult(opportunityResponse, "Read demo opportunities");
  checkDemoContacts(contacts, [...existingContacts, ...requireResult(emailResponse, "Check demo email conflicts"), ...requireResult(phoneResponse, "Check demo phone conflicts")]);
  const contactIds = new Set(existingContacts.map(row => row.id)), opportunityIds = new Set(existingOpportunities.map(row => row.id));
  const companies = data.companies.filter(row => !contactIds.has(row.id!)), people = data.people.filter(row => !contactIds.has(row.id!)), opportunities = data.opportunities.filter(row => !opportunityIds.has(row.id!));
  console.log(JSON.stringify({ mode: args.includes("--apply") ? "apply" : "preview", owner: owner.display_name, ownerRole: owner.role,
    add: { companies: companies.length, people: people.length, opportunities: opportunities.length, provisionalStages: stagesToAdd.length, provisionalCategories: categoriesToAdd.length },
    existingDemo: { contacts: existingContacts.length, opportunities: existingOpportunities.length } }, null, 2));
  if (!args.includes("--apply")) { console.log("Read-only preview complete. Run npm run seed:demo -- --apply to insert missing rows. Existing rows, accounts, targets and actual contributions are preserved."); return; }
  // Separate requests preserve FK ordering. Missing-row inserts ignore duplicate
  // IDs on a concurrent/repeated run; existing rows are never overwritten.
  if (stagesToAdd.length) requireResult(await client.from("pipeline_stages").upsert(stagesToAdd, { onConflict: "id", ignoreDuplicates: true }).select("id"), "Add provisional stages");
  if (categoriesToAdd.length) requireResult(await client.from("contribution_categories").upsert(categoriesToAdd, { onConflict: "id", ignoreDuplicates: true }).select("id"), "Add provisional categories");
  if (companies.length) requireResult(await client.from("contacts").upsert(companies, { onConflict: "id", ignoreDuplicates: true, defaultToNull: false }).select("id"), "Add demo companies");
  if (people.length) requireResult(await client.from("contacts").upsert(people, { onConflict: "id", ignoreDuplicates: true, defaultToNull: false }).select("id"), "Add demo individuals");
  if (opportunities.length) requireResult(await client.from("opportunities").upsert(opportunities, { onConflict: "id", ignoreDuplicates: true, defaultToNull: false }).select("id"), "Add demo opportunities");
  const [savedContacts, savedDeals] = await Promise.all([
    client.from("contacts").select("id,kind").in("id", demoContactIds),
    client.from("opportunities").select("id,contact:contact_id(id),stage:stage_id(id),category:contribution_category_id(id)").in("id", demoOpportunityIds),
  ]);
  const verifiedContacts = requireResult(savedContacts, "Verify demo contacts"), verifiedDeals = requireResult(savedDeals, "Verify demo opportunities and joins");
  if (verifiedContacts.filter(row => row.kind === "company").length !== 3 || verifiedContacts.filter(row => row.kind === "individual").length !== 8 || verifiedDeals.length !== 8 || verifiedDeals.some(row => !row.contact || !row.stage || !row.category)) throw new SeedError("Demo verification is incomplete. Some requests may have succeeded; refresh and rerun to add missing rows.");
  console.log("Verified in the configured Supabase project: 3 demo companies, 8 demo individuals and 8 demo opportunities with contact/stage/category joins. Refresh Contacts and Opportunities. No actual contributions were created.");
}
main().catch(error => {
  const expected = error instanceof SeedError || (error instanceof Error && /active PSE|active stage|demo email/.test(error.message));
  console.error(expected ? error.message : "Demo seed failed. Check the private connection configuration and rerun; partial inserts are preserved and missing rows can be retried.");
  process.exitCode = 1;
});
