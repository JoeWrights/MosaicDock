import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { WorkspaceSidebarContext } from "../../layouts/WorkspaceLayout";
import { WorkspacePageHeader } from "./WorkspacePageHeader";

describe("WorkspacePageHeader", () => {
  it("uses the shared new-session title spacing and sidebar toggle", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [sidebarOpen, setSidebarOpen] = useState(true);

      return (
        <WorkspaceSidebarContext.Provider
          value={{
            sidebarOpen,
            toggleSidebar: () => setSidebarOpen((current) => !current),
            closeSidebar: () => setSidebarOpen(false),
          }}
        >
          <WorkspacePageHeader title="助手" />
        </WorkspaceSidebarContext.Provider>
      );
    }

    render(<Harness />);

    expect(screen.getByTestId("workspace-page-header")).toHaveClass("h-14");
    expect(screen.getByTestId("workspace-page-header-title-row")).toHaveClass("gap-3");
    expect(screen.getByRole("heading", { name: "助手" })).toHaveClass("text-sm");

    await user.click(screen.getByRole("button", { name: "收起侧边栏" }));
    expect(screen.getByRole("button", { name: "展开侧边栏" })).toBeInTheDocument();
  });
});
