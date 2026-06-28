import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Textarea } from "./textarea";

describe("Textarea", () => {
  it("uses a single border treatment when focused", () => {
    render(<Textarea aria-label="描述" />);

    const textarea = screen.getByRole("textbox", { name: "描述" });

    expect(textarea).toHaveClass("focus-visible:border-pink-500");
    expect(textarea).toHaveClass("focus-visible:ring-0");
    expect(textarea.className).not.toContain("focus-visible:ring-2");
    expect(textarea.className).not.toContain("focus-visible:ring-offset-2");
  });
});
