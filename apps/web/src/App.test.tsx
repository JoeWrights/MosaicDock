import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("renders the login page without the workspace shell on /login", () => {
    window.history.pushState({}, "", "/login");

    const { container } = render(<App />);

    expect(screen.getByRole("heading", { name: "Mosaic Dock" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登录" })).toBeInTheDocument();
    expect(screen.queryByText("聊天工作台")).not.toBeInTheDocument();
    expect(container.querySelector("aside")).toBeNull();
    expect(container.querySelector('[class*="ant-"]')).toBeNull();
  });

  it("redirects anonymous users from the workspace to /login", async () => {
    window.history.pushState({}, "", "/");

    const { container } = render(<App />);

    expect(await screen.findByRole("button", { name: "登录" })).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.pathname).toBe("/login");
    });
    expect(container.querySelector("aside")).toBeNull();
    expect(container.querySelector('[class*="ant-"]')).toBeNull();
  });
});
