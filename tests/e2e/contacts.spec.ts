import { expect, test } from "@playwright/test";

test("contact mutations require authentication", async ({ request }) => {
  const created = await request.post("/api/contacts", {
    data: { kind: "individual", name: "Fictional Anonymous", email: "anonymous@example.invalid" },
  });
  expect(created.status()).toBe(401);
  const edited = await request.patch("/api/contacts/10000000-0000-4000-8000-000000000001", {
    data: { notes: "Anonymous change" },
  });
  expect(edited.status()).toBe(401);
  expect((await request.delete("/api/contacts/10000000-0000-4000-8000-000000000001")).status()).toBe(401);
  expect(
    (await request.post("/api/contacts/duplicates", { data: { email: "anonymous@example.invalid" } })).status(),
  ).toBe(401);
});

test("anonymous contact details and edit routes require sign-in", async ({ page }) => {
  for (const path of [
    "/contacts/10000000-0000-4000-8000-000000000001",
    "/contacts/10000000-0000-4000-8000-000000000001/edit",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?/);
  }
});
