import { expect, test } from "@playwright/test";
const id = "20000000-0000-4000-8000-000000000001";
test("opportunity data, mutations and configuration require authentication", async ({ request }) => {
  for (const path of ["/api/opportunities", `/api/opportunities/${id}`, "/api/opportunities/options"]) expect((await request.get(path)).status()).toBe(401);
  expect((await request.post("/api/opportunities", { data: {} })).status()).toBe(401);
  expect((await request.patch(`/api/opportunities/${id}`, { data: { stage_id: id } })).status()).toBe(401);
  expect((await request.delete(`/api/opportunities/${id}`)).status()).toBe(401);
  expect((await request.post("/api/opportunities/configuration", { data: { entity: "starter" } })).status()).toBe(401);
});
test("opportunity forms, board and settings require sign-in", async ({ page }) => {
  for (const path of ["/opportunities?view=board", "/opportunities/new", `/opportunities/${id}`, `/opportunities/${id}/edit`, "/settings"]) {
    await page.goto(path); await expect(page).toHaveURL(/\/login\?/);
  }
});
