import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "./MarkdownContent";

describe("MarkdownContent", () => {
  it("renders markdown blocks and inline formatting", () => {
    render(<MarkdownContent content={"## 标题\n\n- **重点** 项"} />);

    expect(screen.getByRole("heading", { name: "标题" })).toBeInTheDocument();
    expect(screen.getByText("重点")).toBeInTheDocument();
  });

  it("renders code blocks with language labels and copy buttons", () => {
    const { container } = render(<MarkdownContent content={"```ts\nconst value = 1;\n```"} />);

    expect(screen.getByText("ts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复制代码" })).toBeInTheDocument();
    expect(container.querySelector("code")?.textContent).toContain("const value = 1;");
  });

  it("renders tables in a custom table block", () => {
    const { container } = render(
      <MarkdownContent content={"| 参数 | 默认值 |\n| --- | --- |\n| retry | 3 |"} />,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(container.querySelector(".custom-table-block")).not.toBeNull();
  });

  it("escapes raw html before rendering markdown", () => {
    const { container } = render(<MarkdownContent content={"<script>alert(1)</script>"} />);

    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
  });
});
