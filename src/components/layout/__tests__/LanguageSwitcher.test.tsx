import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import {
  mockRouterReplace,
  resetNavigationMocks,
  setMockLocale,
  setMockPathname,
} from "./setup";
import { LanguageSwitcher } from "../LanguageSwitcher";

afterEach(() => {
  cleanup();
  resetNavigationMocks();
});

describe("LanguageSwitcher", () => {
  it("shows the active locale label on the trigger", () => {
    setMockLocale("id");

    render(<LanguageSwitcher />);

    expect(screen.getByRole("button", { name: "Switch Language" })).toHaveTextContent(
      "Bahasa Indonesia",
    );
  });

  it("opens a dropdown with all supported locales", async () => {
    const user = userEvent.setup();

    render(<LanguageSwitcher />);

    await user.click(screen.getByRole("button", { name: "Switch Language" }));

    const menu = screen.getByRole("menu");

    expect(within(menu).getByText("English")).toBeInTheDocument();
    expect(within(menu).getByText("Bahasa Indonesia")).toBeInTheDocument();
    expect(within(menu).getByText("Chinese")).toBeInTheDocument();
  });

  it("navigates to the selected locale", async () => {
    const user = userEvent.setup();

    setMockLocale("en");
    setMockPathname("/discover");

    render(<LanguageSwitcher />);

    await user.click(screen.getByRole("button", { name: "Switch Language" }));
    await user.click(screen.getByText("Bahasa Indonesia"));

    expect(mockRouterReplace).toHaveBeenCalledWith(
      { pathname: "/discover" },
      { locale: "id" },
    );
  });
});
