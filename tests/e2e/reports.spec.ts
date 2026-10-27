import { expect, test } from "@playwright/test";
test("report cache refresh requires authentication", async ({ request }) => {
  const response = await request.post("/api/reports/refresh");
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
});
test("report aggregates require authentication for all filter selections", async ({ request }) => {
  for (const query of [
    "",
    "?year=2026&period=q1&currency=BDT",
    "?year=2026&period=m03&vertical_id=unassigned&currency=USD",
  ]) {
    const response = await request.get("/api/reports" + query);
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(await response.json()).not.toHaveProperty("report");
  }
});
test("dashboard/report filters preserve the sign-in return destination", async ({ page }) => {
  for (const path of [
    "/dashboard?year=2026&period=q1&currency=BDT",
    "/reports?year=2026&period=m03&vertical_id=unassigned&currency=USD",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?/);
    expect(new URL(page.url()).searchParams.get("next")).toBe(path);
  }
});
