// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ChartFrame } from "../../src/components/charts/chart-frame";

afterEach(cleanup);

describe("chart frames", () => {
  it("names the figure, hides the plot and mirrors it in a table", () => {
    render(
      <ChartFrame title="Fictional chart" code="TST-1" table={{ columns: ["Month", "Value"], rows: [["Jan", "5"]] }}>
        <svg data-testid="plot" />
      </ChartFrame>,
    );
    const figure = screen.getByRole("figure", { name: "Fictional chart" });
    expect(screen.getByTestId("plot").parentElement?.getAttribute("aria-hidden")).toBe("true");
    expect(within(figure).getByRole("table", { name: "Fictional chart" })).toBeTruthy();
    expect(within(figure).getByRole("row", { name: "Jan 5" })).toBeTruthy();
  });
  it("shows a legend only for two or more series", () => {
    const { container, unmount } = render(
      <ChartFrame
        title="Two series"
        legend={[
          { label: "Target", tone: "neutral", mark: "outline" },
          { label: "Actual", tone: "accent", mark: "bar" },
        ]}
        table={{ columns: ["Q"], rows: [] }}
      >
        <svg />
      </ChartFrame>,
    );
    expect(container.textContent).toContain("Target");
    unmount();
    const single = render(
      <ChartFrame
        title="One series"
        legend={[{ label: "Actual", tone: "accent", mark: "bar" }]}
        table={{ columns: ["Q"], rows: [] }}
      >
        <svg />
      </ChartFrame>,
    );
    expect(single.container.textContent).not.toContain("Actual");
  });
  it("replaces the plot and table with a clear message when there is nothing to show", () => {
    render(
      <ChartFrame
        title="Empty chart"
        empty
        emptyText="No contributions recognized in this period."
        table={{ columns: ["Q"], rows: [] }}
      >
        <svg data-testid="plot" />
      </ChartFrame>,
    );
    expect(screen.getByText("No contributions recognized in this period.")).toBeTruthy();
    expect(screen.queryByTestId("plot")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
