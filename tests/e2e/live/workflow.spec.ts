import {
  deleteFromDetailPage,
  expect,
  heading,
  liveEnabled,
  liveSkipReason,
  qaName,
  recordPath,
  signIn,
  test,
} from "../helpers/live";

test.skip(!liveEnabled, liveSkipReason);
// About two dozen page visits; a development server compiles each page on its first visit.
test.describe.configure({ timeout: 240_000 });

// Contact → deal → meeting → activity, the assessment's relationship model, then edits, a stage move,
// deletes blocked by linked records, and deletion in reverse order.
test("linked records can be created, edited, moved and deleted in dependency order", async ({ page, qa }) => {
  await signIn(page);
  const names = {
    contact: qaName("Person"),
    deal: qaName("Deal"),
    meeting: qaName("Meeting"),
    activity: qaName("Activity"),
  };

  await page.goto("/contacts/new");
  await page.getByLabel("Contact name").fill(names.contact);
  await page.getByLabel("Email address").fill(`qa-${Date.now()}@example.invalid`);
  await page.getByRole("button", { name: "Create contact", exact: true }).click();
  await expect(heading(page, names.contact)).toBeVisible({ timeout: 30000 });
  const contact = recordPath(page);
  qa.track(contact);

  await page.goto("/opportunities/new");
  await page.getByLabel("Deal name *").fill(names.deal);
  await page.getByLabel("Contribution category *").selectOption({ index: 1 });
  await page.getByLabel("Stage *").selectOption({ index: 1 });
  await page.getByRole("combobox", { name: "Individual / company" }).fill(names.contact);
  await page.getByRole("option").filter({ hasText: names.contact }).getByRole("button").click();
  await page.getByLabel("Budgeted fund (expected value) *").fill("1000.00");
  await page.getByRole("button", { name: "Create deal", exact: true }).click();
  await expect(heading(page, names.deal)).toBeVisible({ timeout: 30000 });
  const deal = recordPath(page);
  qa.track(deal);

  // Stage move to the next configured stage, recorded in the deal's audit history.
  const move = page.getByLabel("Move to stage");
  const stages = await move.locator("option").allTextContents();
  const from = stages[await move.evaluate((select: HTMLSelectElement) => select.selectedIndex)];
  const to = stages[stages.indexOf(from) + 1] ?? stages[0];
  await move.selectOption({ label: to });
  await page.getByRole("button", { name: "Move", exact: true }).click();
  await expect(page.getByText(`Stage: ${from} → ${to}`)).toBeVisible({ timeout: 30000 });

  await page.goto(`/meetings/new?opportunity_id=${deal.split("/").pop()}`);
  await page.getByLabel("Meeting title *").fill(names.meeting);
  await page.getByLabel("Meeting date and time (Asia/Dhaka) *").fill("2026-11-02T10:30");
  await page.getByRole("button", { name: "Create meeting", exact: true }).click();
  await expect(heading(page, names.meeting)).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("link", { name: names.deal })).toBeVisible();
  const meeting = recordPath(page);
  qa.track(meeting);

  await page.goto(`/activities/new?meeting_id=${meeting.split("/").pop()}`);
  await page.getByLabel("Activity notes / context *").fill(`${names.activity}\nLive workflow check.`);
  await page.getByRole("button", { name: "Create activity", exact: true }).click();
  await expect(heading(page, names.activity)).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("link", { name: names.meeting })).toBeVisible();
  const activity = recordPath(page);
  qa.track(activity);

  // Edit each record and confirm the change survives a reload.
  for (const [path, link, label, value] of [
    [contact, "Edit contact", "Contact name", `${names.contact} edited`],
    [deal, "Edit deal", "Deal name *", `${names.deal} edited`],
    [meeting, "Edit meeting", "Meeting title *", `${names.meeting} edited`],
    [activity, "Edit activity", "Activity notes / context *", `${names.activity} edited\nLive workflow check.`],
  ]) {
    await page.goto(path);
    await page.getByRole("link", { name: link, exact: true }).click();
    await page.getByLabel(label).fill(value);
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    const title = value.split("\n")[0];
    await expect(heading(page, title)).toBeVisible({ timeout: 30000 });
    await page.reload();
    await expect(heading(page, title)).toBeVisible();
  }

  // Each parent is protected while a linked record exists.
  for (const [path, noun] of [
    [contact, "contact"],
    [deal, "opportunity"],
    [meeting, "meeting"],
  ]) {
    await deleteFromDetailPage(page, path, noun);
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect((await page.request.get(`/api${path}`)).status()).toBe(200);
  }

  // Children first, then each parent becomes deletable.
  for (const [path, noun, list] of [
    [activity, "activity", "/activities"],
    [meeting, "meeting", "/meetings"],
    [deal, "opportunity", "/opportunities"],
    [contact, "contact", "/contacts"],
  ]) {
    await deleteFromDetailPage(page, path, noun);
    await expect(page).toHaveURL(new RegExp(`${list}\\?deleted=1$`), { timeout: 30000 });
    expect((await page.request.get(`/api${path}`)).status()).toBe(404);
  }
});
