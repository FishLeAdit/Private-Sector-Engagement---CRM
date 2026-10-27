import { expect, liveEnabled, liveSkipReason, signIn, test } from "../helpers/live";

test.skip(!liveEnabled, liveSkipReason);
test.describe.configure({ timeout: 120_000 });

type Option = { id: string; display_name?: string; name?: string; active: boolean };

// Target plans cannot be deleted, so this fills a new draft without saving it: the save request is blocked.
test("a member's amount splits across verticals by percentage, and saving needs a 100% split", async ({ page, qa }) => {
  await signIn(page);
  const options: { employees: Option[]; verticals: Option[] } = await (
    await page.request.get("/api/targets/options")
  ).json();
  // Rows are labelled by display name, so pick an employee whose name no other active employee shares.
  const active = options.employees.filter(e => e.active);
  const member = active.find(
    e => active.filter(other => other.display_name === e.display_name).length === 1,
  )?.display_name;
  const [first, second] = options.verticals.filter(v => v.active).map(v => v.name);
  test.skip(!member || !second, "Needs an active employee and two active target verticals.");

  await page.goto("/targets/new");
  await page.getByLabel("Annual target *").fill("1000000");
  await page.getByLabel("Q1 target").fill("400000");
  const percentage = (vertical: string) => page.getByLabel(`Q1 ${member} ${vertical} %`, { exact: true });
  // The calculated amount sits under each percentage box and is announced with it.
  const calculated = async (vertical: string) =>
    page.locator(`[id="${await percentage(vertical).getAttribute("aria-describedby")}"]`);

  await page.getByLabel(`Q1 ${member} amount`, { exact: true }).fill("300000");
  await percentage(first!).fill("50");
  await expect(page.getByText("50% (50% left)")).toBeVisible();
  await percentage(second!).fill("60");
  await expect(page.getByText("110% (10% over)")).toBeVisible();

  // An unfinished split is explained and nothing is sent.
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText(/the vertical split totals 110%; it must total 100%/)).toBeVisible();
  expect(qa.blocked).toEqual([]);

  await percentage(second!).fill("50");
  await expect(await calculated(first!)).toHaveText("150000.00");
  await expect(await calculated(second!)).toHaveText("150000.00");
  await expect(
    page.getByText("Q1 target BDT 400,000.00 · allocated to members BDT 300,000.00 · left to allocate BDT 100,000.00"),
  ).toBeVisible();

  // Other quarters keep their own members' amounts.
  await page.getByRole("button", { name: "Q2", exact: true }).click();
  await expect(page.getByLabel(`Q2 ${member} amount`, { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Q1", exact: true }).click();
  await expect(page.getByLabel(`Q1 ${member} amount`, { exact: true })).toHaveValue("300000");

  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText(/Save result is uncertain/)).toBeVisible({ timeout: 30000 });
  expect(qa.blocked).toEqual(["POST /api/targets"]);
});
