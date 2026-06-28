import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import SchedulerPage from ".";

describe("SchedulerPage", () => {
  it("renders the guada-style scheduler empty state", () => {
    render(
      <MemoryRouter>
        <SchedulerPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "定时任务" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建任务" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "刷新" })).toBeInTheDocument();
    expect(screen.getByText("暂无定时任务")).toBeInTheDocument();
    expect(screen.getByText('点击"新建任务"开始创建')).toBeInTheDocument();
  });
});
