// Explicit administrative demo data. Never imported by application code.
import { z } from "zod";
import { createHostedDemoClient, requireResult, SeedError } from "./lib/hosted-demo";
import { chooseDemoOwner, demoOpportunityIds } from "./lib/demo-data";
import {
  buildDemoFinance,
  demoFinanceYears,
  demoFinanceVerticals,
  demoTargetIds,
  demoContributionIds,
  demoVerticalIds,
} from "./lib/demo-finance";
import { cents, performance } from "../src/features/finance/money";
import { toDhakaDateTimeInput } from "../src/lib/dates";
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(
      "npm.cmd run seed:finance -- [--apply] [--owner=EXISTING_PSE_MANAGER_UUID]\nDefault read-only preview. Adds missing fictional receipts, two draft target plans and provisional demo verticals. Existing data and edits are preserved. Plans are not automatically approved.",
    );
    return;
  }
  if (args.some(a => a !== "--apply" && !a.startsWith("--owner="))) throw new SeedError("Unknown option. Use --help.");
  const requested = args.find(a => a.startsWith("--owner="))?.slice(8);
  if (requested && !z.uuid().safeParse(requested).success)
    throw new SeedError("--owner must be an existing active PSE manager UUID.");
  const client = createHostedDemoClient();
  const [profileResult, opportunityResult, planResult, verticalResult, receiptResult] = await Promise.all([
    client
      .from("profiles")
      .select("id,display_name,department,role,active")
      .eq("department", "PSE")
      .eq("active", true)
      .in("role", ["pse_member", "pse_manager", "admin"])
      .order("created_at")
      .order("id")
      .limit(1000),
    client.from("opportunities").select("id,currency,contribution_type").in("id", demoOpportunityIds).order("id"),
    client.from("target_plans").select("id,year,currency,status").order("year").order("currency").limit(1000),
    client
      .from("target_verticals")
      .select("id,code,active")
      .or(`id.in.(${demoVerticalIds.join(",")}),code.in.(DEMO_DSP,DEMO_VBD,DEMO_PROJECT)`),
    client.from("recognized_contributions").select("id").in("id", demoContributionIds),
  ]);
  const profiles = requireResult(profileResult, "Read PSE profiles"),
    manager = chooseDemoOwner(profiles, requested),
    plans = requireResult(planResult, "Read target slots");
  if (plans.length === 1000)
    throw new SeedError("Target preflight reached its 1,000-plan bound; review target slots before seeding.");
  const years = demoFinanceYears(plans, Number(toDhakaDateTimeInput(new Date().toISOString()).slice(0, 4))),
    rows = buildDemoFinance(
      manager,
      profiles,
      requireResult(opportunityResult, "Read current demo opportunities"),
      years,
    );
  const verticals = requireResult(verticalResult, "Read demo verticals"),
    receipts = requireResult(receiptResult, "Read demo receipts");
  for (const row of demoFinanceVerticals)
    if (
      verticals.some(v => v.code === row.code && v.id !== row.id) ||
      verticals.some(v => v.id === row.id && !v.active)
    )
      throw new SeedError(
        "A demo vertical code conflicts or its saved vertical is inactive. Existing configuration is preserved; review it before adding examples.",
      );
  const missingVerticals = demoFinanceVerticals.filter(v => !verticals.some(existing => existing.id === v.id)),
    missingPlans = rows.plans.filter(p => !plans.some(existing => existing.id === p.id)),
    missingReceipts = rows.contributions.filter(r => !receipts.some(existing => existing.id === r.id));
  console.log(
    JSON.stringify(
      {
        mode: args.includes("--apply") ? "apply" : "preview",
        manager: manager.display_name,
        years,
        addProvisionalVerticals: missingVerticals.length,
        addDraftPlans: missingPlans.length,
        addReceipts: missingReceipts.length,
        expectedNewDatasetTotals: { BDT: 280000, USD: 200 },
        expectedQ1: "165,000 / 150,000 BDT = 110%; Q2 stays 250,000",
      },
      null,
      2,
    ),
  );
  if (!args.includes("--apply")) {
    console.log("Read-only preview. Use npm.cmd run seed:finance -- --apply to insert missing examples.");
    return;
  }
  if (missingVerticals.length)
    requireResult(
      await client
        .from("target_verticals")
        .upsert(missingVerticals, { onConflict: "id", ignoreDuplicates: true, defaultToNull: false })
        .select("id"),
      "Insert provisional demo verticals",
    );
  for (const plan of missingPlans)
    requireResult(
      await client.rpc("seed_demo_target", { p_id: plan.id, p_values: plan.values }),
      "Insert new demo target snapshot atomically",
    );
  if (missingReceipts.length)
    requireResult(
      await client
        .from("recognized_contributions")
        .upsert(missingReceipts, { onConflict: "id", ignoreDuplicates: true, defaultToNull: false })
        .select("id"),
      "Insert missing fictional receipts",
    );
  const [savedPlans, savedReceipts, quarters, cells] = await Promise.all([
    client
      .from("target_plans")
      .select("id,year,currency,status,quarters:target_quarters(quarter,amount)")
      .in("id", demoTargetIds),
    client
      .from("recognized_contributions")
      .select(
        "id,amount,currency,recognized_at,notes,employee:employee_id(id),opportunity:opportunity_id(id),vertical:target_vertical_id(id)",
      )
      .in("id", demoContributionIds),
    client.from("target_quarters").select("quarter,amount").eq("plan_id", demoTargetIds[0]).order("quarter"),
    client.from("target_allocations").select("quarter,amount").eq("plan_id", demoTargetIds[0]).limit(1000),
  ]);
  const verifiedPlans = requireResult(savedPlans, "Verify target plans"),
    verifiedReceipts = requireResult(savedReceipts, "Verify receipts/joins");
  const verifiedQuarters = requireResult(quarters, "Verify quarter baselines"),
    verifiedCells = requireResult(cells, "Verify allocation cells");
  const primary = verifiedPlans.find(p => p.id === demoTargetIds[0]);
  const q1Actual = verifiedReceipts
    .filter(r => {
      const time = toDhakaDateTimeInput(r.recognized_at);
      return (
        r.currency === primary?.currency && Number(time.slice(0, 4)) === primary?.year && Number(time.slice(5, 7)) <= 3
      );
    })
    .reduce((sum, r) => sum + cents(r.amount), 0n);
  const q1 = performance(cents(verifiedQuarters.find(q => q.quarter === 1)?.amount ?? 0), q1Actual);
  if (
    missingPlans.some(p => p.id === demoTargetIds[0]) &&
    (verifiedQuarters.length !== 4 ||
      verifiedQuarters.some(
        q =>
          verifiedCells.filter(a => a.quarter === q.quarter).reduce((sum, a) => sum + cents(a.amount), 0n) !==
          cents(q.amount),
      ))
  )
    throw new SeedError("New target allocations did not reconcile during verification.");
  if (
    verifiedPlans.length !== 2 ||
    verifiedReceipts.length !== 6 ||
    verifiedReceipts.some(r => !r.employee || !r.opportunity)
  )
    throw new SeedError(
      "Finance seed verification is incomplete. Existing records remain preserved; rerun to add missing examples.",
    );
  console.log(
    JSON.stringify(
      {
        verifiedPlans: verifiedPlans.map(p => ({
          year: p.year,
          currency: p.currency,
          status: p.status,
          quarters: p.quarters.length,
        })),
        verifiedReceipts: verifiedReceipts.length,
        q1,
        q2Target: verifiedQuarters.find(q => q.quarter === 2)?.amount,
        totals: verifiedReceipts.reduce<Record<string, number>>(
          (s, r) => ({ ...s, [r.currency]: (s[r.currency] ?? 0) + Number(r.amount) }),
          {},
        ),
        links: demoTargetIds.map(id => `http://localhost:3000/targets/${id}`),
      },
      null,
      2,
    ),
  );
  console.log(
    "Fictional finance data verified. Existing records/edits are preserved; no opportunity, contact, meeting, activity, user or role was changed. Draft plans require your own review/approval.",
  );
}
main().catch(error => {
  console.error(
    error instanceof SeedError || (error instanceof Error && /active PSE|Existing BDT|free demo/.test(error.message))
      ? error.message
      : "Finance seed failed. Check private configuration and retry; existing records are preserved.",
  );
  process.exitCode = 1;
});
