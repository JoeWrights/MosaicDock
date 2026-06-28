import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "./switch";

describe("Switch", () => {
  it("renders a custom switch instead of a native checkbox", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    const { container } = render(
      <Switch ariaLabel="自动启用全部工具" checked={false} onCheckedChange={onCheckedChange} />,
    );

    const toggle = screen.getByRole("switch", { name: "自动启用全部工具" });

    expect(container.querySelector('input[type="checkbox"]')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await user.click(toggle);

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
