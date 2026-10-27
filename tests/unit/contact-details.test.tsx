// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ContactHistoryLists } from "../../src/components/contacts/contact-details";

afterEach(cleanup);

describe("contact history lists", () => {
  it("formats expected deal values like every other money figure", () => {
    render(
      <ContactHistoryLists
        history={{
          opportunities: [
            {
              id: "20000000-0000-4000-8000-000000000001",
              deal_name: "Fictional sponsorship",
              expected_amount: 1500000,
              currency: "BDT",
              created_at: "2026-10-01T00:00:00Z",
            },
            {
              id: "20000000-0000-4000-8000-000000000002",
              deal_name: "Fictional grant",
              expected_amount: 2500.5,
              currency: "USD",
              created_at: "2026-10-02T00:00:00Z",
            },
          ],
          meetings: [],
          activities: [],
        }}
      />,
    );
    expect(screen.getByText("BDT 1,500,000.00 expected")).toBeTruthy();
    expect(screen.getByText("USD 2,500.50 expected")).toBeTruthy();
  });
});
