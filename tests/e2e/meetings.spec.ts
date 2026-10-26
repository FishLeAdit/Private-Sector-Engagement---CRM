import { expect, test } from "@playwright/test";

const id = "30000000-0000-4000-8000-000000000001";

test("meeting data, edits and follow-up creation require authentication", async ({ request }) => {
  for (const path of ["/api/meetings", `/api/meetings/${id}`, "/api/meetings/options"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  expect((await request.post("/api/meetings", { data: { title: "Fictional anonymous meeting" } })).status()).toBe(401);
  expect((await request.patch(`/api/meetings/${id}`, { data: { status: "done" } })).status()).toBe(401);
  expect((await request.delete(`/api/meetings/${id}`)).status()).toBe(401);
  expect((await request.post(`/api/meetings/${id}/follow-ups`, { data: { notes: "Fictional anonymous follow-up" } })).status()).toBe(401);
});

test("meeting list, new, detail and edit pages require sign-in", async ({ page }) => {
  for (const path of ["/meetings", "/meetings/new", `/meetings/${id}`, `/meetings/${id}/edit`]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?/);
  }
});
