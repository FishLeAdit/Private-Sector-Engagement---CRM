import { expect, test } from "@playwright/test";
const id = "40000000-0000-4000-8000-000000000001";
test("activity data, deletion and internal lookup require authentication", async ({ request }) => {
  for (const path of ["/api/activities", `/api/activities/${id}`, "/api/activities/options"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  expect(
    (
      await request.post("/api/activities", { data: { activity_type: "general", notes: "Fictional anonymous work" } })
    ).status(),
  ).toBe(401);
  expect((await request.patch(`/api/activities/${id}`, { data: { status: "done" } })).status()).toBe(401);
  expect((await request.delete(`/api/activities/${id}`)).status()).toBe(401);
});
test("activity list, new, detail and edit require sign-in", async ({ page }) => {
  for (const path of ["/activities", "/activities/new", `/activities/${id}`, `/activities/${id}/edit`]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?/);
  }
});
