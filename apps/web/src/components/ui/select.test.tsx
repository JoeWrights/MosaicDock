import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./select";

describe("Select", () => {
  it("renders a styled custom listbox instead of a native select popup", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(
      <Select
        ariaLabel="分组设置"
        placeholder="请选择分组"
        value=""
        options={[
          { value: "", label: "请选择分组" },
          { value: "group-1", label: "测试分组" },
        ]}
        onValueChange={onValueChange}
      />,
    );

    expect(container.querySelector("select")).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "分组设置" }));

    const listbox = screen.getByRole("listbox", { name: "分组设置" });
    expect(listbox).toHaveClass("rounded-xl");
    expect(listbox).toHaveClass("shadow-lg");

    await user.click(screen.getByRole("option", { name: "测试分组" }));
    expect(onValueChange).toHaveBeenCalledWith("group-1");
  });

  it("portals the listbox outside overflow containers", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div className="overflow-hidden">
        <Select
          ariaLabel="模型选择"
          placeholder="请选择模型"
          value=""
          options={[
            { value: "", label: "请选择模型" },
            { value: "model-1", label: "测试模型" },
          ]}
          onValueChange={vi.fn()}
        />
      </div>,
    );

    await user.click(screen.getByRole("combobox", { name: "模型选择" }));

    const listbox = screen.getByRole("listbox", { name: "模型选择" });
    expect(listbox).toHaveClass("fixed");
    expect(container.contains(listbox)).toBe(false);
    expect(listbox.parentElement).toBe(document.body);
  });

  it("shows a stable empty dropdown when there are no options", async () => {
    const user = userEvent.setup();
    render(
      <Select
        ariaLabel="引用知识库"
        placeholder="请选择知识库（可多选）"
        value=""
        options={[]}
        onValueChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "引用知识库" }));

    const listbox = screen.getByRole("listbox", { name: "引用知识库" });
    expect(listbox).toHaveClass("min-h-12");
    expect(screen.getByText("暂无选项")).toBeInTheDocument();
  });
});
