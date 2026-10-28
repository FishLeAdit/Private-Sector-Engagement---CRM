// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("../../src/app/(auth)/actions", () => ({ signOutAction: vi.fn(async () => ({ error: "" })) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/opportunities" }));
import { AccountMenu } from "../../src/components/shell/account-menu";
import { ShellNav } from "../../src/components/shell/nav";
afterEach(cleanup);

const button = () => screen.getByRole("button", { name: "Fictional Manager, PSE manager: account menu" });

describe("account menu", () => {
  it("opens to Settings and Sign out, and closes when Settings is chosen", () => {
    const navigate = vi.fn();
    render(<AccountMenu name="Fictional Manager" role="PSE manager" onNavigate={navigate} />);
    expect(button().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
    fireEvent.click(button());
    expect(button().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
    const settings = screen.getByRole("link", { name: "Settings" });
    expect(settings.getAttribute("href")).toBe("/settings");
    fireEvent.click(settings);
    expect(button().getAttribute("aria-expanded")).toBe("false");
    expect(navigate).toHaveBeenCalled();
  });
  it("closes on Escape, returning focus to the button, and on a click outside", () => {
    render(
      <>
        <AccountMenu name="Fictional Manager" role="PSE manager" />
        <p>Elsewhere</p>
      </>,
    );
    fireEvent.click(button());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(button().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button());
    fireEvent.click(button());
    fireEvent.pointerDown(screen.getByText("Elsewhere"));
    expect(button().getAttribute("aria-expanded")).toBe("false");
  });
});

describe("navigation rail", () => {
  it("leaves Settings to the account menu and marks the current section", () => {
    render(<ShellNav name="Fictional Manager" role="PSE manager" />);
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(nav.querySelector('a[href="/settings"]')).toBeNull();
    expect(screen.getByRole("link", { name: "Opportunities" }).getAttribute("aria-current")).toBe("page");
    expect(button()).toBeTruthy();
  });
});
