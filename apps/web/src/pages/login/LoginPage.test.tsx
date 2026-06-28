import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginPage } from ".";

describe("LoginPage", () => {
  it("stores the access token in sessionStorage when remember me is unchecked", async () => {
    const login = vi.fn(async () => ({
      accessToken: "token-123",
      tokenType: "Bearer",
      user: {
        id: "user-1",
        username: "admin",
        isActive: true,
      },
    }));
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();
    localStorage.setItem("token", "old-token");
    localStorage.setItem("user", JSON.stringify({ username: "old-user" }));

    const { container } = render(
      <LoginPage
        api={{ client: { login } }}
        onAuthenticated={onAuthenticated}
      />,
    );

    await user.type(screen.getByPlaceholderText("用户名"), "admin");
    await user.type(screen.getByPlaceholderText("密码"), "password");
    await user.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        username: "admin",
        password: "password",
        type: "email",
        rememberMe: false,
      });
    });
    expect(sessionStorage.getItem("token")).toBe("token-123");
    expect(sessionStorage.getItem("user")).toContain("admin");
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(onAuthenticated).toHaveBeenCalledWith(
      expect.objectContaining({ username: "admin" }),
    );
    expect(container.querySelector('[class*="ant-"]')).toBeNull();
  });

  it("stores the access token in localStorage when remember me is checked", async () => {
    const login = vi.fn(async () => ({
      accessToken: "token-456",
      tokenType: "Bearer",
      user: {
        id: "user-1",
        username: "admin",
        isActive: true,
      },
    }));
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();
    sessionStorage.setItem("token", "old-token");
    sessionStorage.setItem("user", JSON.stringify({ username: "old-user" }));

    render(
      <LoginPage
        api={{ client: { login } }}
        onAuthenticated={onAuthenticated}
      />,
    );

    await user.type(screen.getByPlaceholderText("用户名"), "admin");
    await user.type(screen.getByPlaceholderText("密码"), "password");
    await user.click(screen.getByRole("checkbox", { name: "记住我" }));
    await user.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        username: "admin",
        password: "password",
        type: "email",
        rememberMe: true,
      });
    });
    expect(localStorage.getItem("token")).toBe("token-456");
    expect(localStorage.getItem("user")).toContain("admin");
    expect(sessionStorage.getItem("token")).toBeNull();
    expect(sessionStorage.getItem("user")).toBeNull();
  });
});
