// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OdooImportCheck } from "../../src/components/settings/odoo-import-check";
import type { DryRunReport } from "../../src/features/odoo/types";

const report: DryRunReport = {
  offline: false,
  files: {
    contacts: { rows: 5, ready: 4, missing: [], ignored: ["x_custom"] },
    deals: { rows: 0, ready: 0, missing: [], ignored: [] },
    activities: { rows: 1, ready: 0, missing: ["activity_type"], ignored: [] },
  },
  findings: [{ file: "contacts", line: 5, odooId: "res_partner_104", message: "email: same as line 3." }],
};
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetcher = vi.fn(async (url: string) =>
    url.startsWith("/odoo-templates/") ? new Response(`sample of ${url}`) : Response.json({ report }),
  );
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const posted = () => JSON.parse(fetcher.mock.calls.find(([url]) => url === "/api/settings/odoo-check")![1].body);

describe("Odoo import check", () => {
  it("sends the chosen files and shows each file's summary and findings", async () => {
    render(<OdooImportCheck />);
    const csv = new File(["odoo_id,name\n"], "contacts.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText(/^Contacts/), { target: { files: [csv] } });
    fireEvent.click(screen.getByRole("button", { name: "Check files" }));
    await screen.findByRole("heading", { name: "Results for contacts.csv" });
    expect(posted()).toEqual({ contacts: "odoo_id,name\n" });
    expect(screen.getByRole("status").textContent).toBe("2 rows need review. Nothing was written.");
    const contacts = within(screen.getByRole("region", { name: "Contacts" }));
    expect(contacts.getByText("Needs review")).toBeTruthy();
    expect(contacts.getByRole("row", { name: /5 res_partner_104 email: same as line 3\./ })).toBeTruthy();
    expect(contacts.getByText("Ignored columns: x_custom")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Deals" })).getByText("No file provided.")).toBeTruthy();
  });
  it("checks the fictional sample files in one click", async () => {
    render(<OdooImportCheck />);
    fireEvent.click(screen.getByRole("button", { name: "Check the mixed samples" }));
    await screen.findByRole("heading", { name: "Results for the mixed samples" });
    expect(posted()).toEqual({
      contacts: "sample of /odoo-templates/mixed/odoo-contacts.csv",
      deals: "sample of /odoo-templates/mixed/odoo-deals.csv",
      activities: "sample of /odoo-templates/mixed/odoo-activities.csv",
    });
    expect(screen.queryByRole("button", { name: /^Import/ })).toBeNull();
    expect(
      within(screen.getByRole("region", { name: "Activities" })).getByText(/missing columns activity_type/),
    ).toBeTruthy();
  });
  it("asks for a file first and shows the server's message on failure", async () => {
    render(<OdooImportCheck />);
    fireEvent.click(screen.getByRole("button", { name: "Check files" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Choose at least one CSV file to check.");
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockImplementation(async (url: string) =>
      url.startsWith("/odoo-templates/")
        ? new Response("x")
        : Response.json({ error: "Only a PSE manager can run the Odoo import check." }, { status: 403 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Check the ready samples" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Only a PSE manager"));
  });

  it("offers the import only when nothing needs review, sends the same files and reports what was added", async () => {
    const clean: DryRunReport = {
      offline: false,
      files: {
        contacts: { rows: 5, ready: 5, missing: [], ignored: [] },
        deals: { rows: 4, ready: 4, missing: [], ignored: [] },
        activities: { rows: 1, ready: 1, missing: [], ignored: [] },
      },
      findings: [],
    };
    fetcher.mockImplementation(async (url: string) =>
      url.startsWith("/odoo-templates/")
        ? new Response(`sample of ${url}`)
        : url === "/api/settings/odoo-check"
          ? Response.json({ report: clean })
          : Response.json({ result: { contacts: ["a", "b"], deals: ["c"], activities: [] } }, { status: 201 }),
    );
    render(<OdooImportCheck />);
    fireEvent.click(screen.getByRole("button", { name: "Check the ready samples" }));
    fireEvent.click(await screen.findByRole("button", { name: "Import 5 contacts, 4 deals, 1 activity" }));
    await screen.findByRole("heading", { name: "Import complete" });
    expect(screen.getByText("Imported 2 contacts, 1 deal, 0 activities.")).toBeTruthy();
    const call = fetcher.mock.calls.find(([url]) => url === "/api/settings/odoo-import")!;
    expect(JSON.parse(call[1].body)).toEqual(posted());
    fireEvent.click(screen.getByRole("button", { name: "Check more files" }));
    expect(screen.queryByRole("heading", { name: "Import complete" })).toBeNull();
  });
});
