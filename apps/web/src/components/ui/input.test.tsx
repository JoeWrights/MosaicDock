import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./input";

describe("Input", () => {
  it("uses a single border treatment when focused", () => {
    render(<Input aria-label="用户名" />);

    const input = screen.getByRole("textbox", { name: "用户名" });

    expect(input).toHaveClass("focus-visible:border-pink-500");
    expect(input).toHaveClass("focus-visible:ring-0");
    expect(input.className).not.toContain("focus-visible:ring-2");
    expect(input.className).not.toContain("focus-visible:ring-offset-2");
  });
});
