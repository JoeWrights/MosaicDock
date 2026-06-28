import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkspaceLayout, { useWorkspaceSidebar } from "./WorkspaceLayout";

const mockClient = vi.hoisted(() => ({
  fetchSessions: vi.fn(),
  fetchSessionGroups: vi.fn(),
  createSessionGroup: vi.fn(async () => ({ id: "group-2", name: "客户项目", sortOrder: 1 })),
  updateSessionGroup: vi.fn(async () => ({ id: "group-1", name: "研发项目", sortOrder: 0 })),
  deleteSessionGroup: vi.fn(async () => ({ success: true })),
  reorderSessionGroups: vi.fn(async () => ({ success: true })),
  updateSession: vi.fn(async (_sessionId: string, data: { title?: string; groupId?: string | null }) => ({
    id: "session-1",
    title: data.title ?? "指数退避重试",
    groupId: data.groupId ?? null,
    createdAt: "2026-06-28T00:00:00.000Z",
    updatedAt: "2026-06-28T00:00:00.000Z",
  })),
  deleteSession: vi.fn(async () => ({ success: true })),
}));

vi.mock("@mosaic-dock/api-client", () => ({
  mosaicApi: {
    client: mockClient,
  },
}));

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/new-session"]}>
      <Routes>
        <Route element={<WorkspaceLayout />}>
          <Route path="/new-session" element={<TestPageHeader />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function TestPageHeader() {
  const { toggleSidebar } = useWorkspaceSidebar();

  return (
    <header>
      <button type="button" aria-label="展开侧边栏" onClick={toggleSidebar}>
        新建页面内容
      </button>
    </header>
  );
}

describe("WorkspaceLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.fetchSessions.mockImplementation(async ({ groupId }: { groupId?: string | null }) => ({
      items:
        groupId === null
          ? [
              {
                id: "session-1",
                title: "指数退避重试",
                groupId: null,
                createdAt: "2026-06-28T00:00:00.000Z",
                updatedAt: "2026-06-28T00:00:00.000Z",
              },
            ]
          : [],
      total: groupId === null ? 1 : 0,
      page: 1,
      pageSize: 10,
    }));
    mockClient.fetchSessionGroups.mockImplementation(async () => [
      { id: "group-1", name: "研发任务", sortOrder: 0 },
    ]);
  });

  it("collapses the guada-style sidebar by default", () => {
    renderLayout();

    expect(screen.getByRole("button", { name: "展开侧边栏" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "主导航" })).not.toBeInTheDocument();
  });

  it("shows guada navigation, sessions and footer actions after expanding", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole("button", { name: "展开侧边栏" }));

    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建任务" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "助手" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "机器人" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "知识库" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "插件市场" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "定时任务" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "模型管理" })).toBeInTheDocument();
    expect(screen.getByText("任务列表")).toBeInTheDocument();
    expect(await screen.findByText("指数退避重试")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "暗色" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "分组" })).toBeInTheDocument();
  });

  it("uses the page header toggle on desktop and keeps the edge handle mobile-only", async () => {
    const user = userEvent.setup();
    renderLayout();

    const toggle = screen.getByRole("button", { name: "展开侧边栏" });

    await user.click(toggle);

    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();

    const edgeHandle = screen.getByRole("button", { name: "移动端收起侧边栏" });
    expect(edgeHandle.className).toContain("lg:hidden");
    expect(edgeHandle.className).toContain("left-[280px]");
    expect(edgeHandle.className).not.toContain("translate-x-[280px]");
  });

  it("does not render a vertical border at the sidebar edge", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole("button", { name: "展开侧边栏" }));

    const sidebar = screen.getByRole("complementary", { hidden: true });
    expect(sidebar.className).not.toContain("border-r");
  });

  it("opens session group management from the sidebar footer", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole("button", { name: "展开侧边栏" }));
    await user.click(screen.getByRole("button", { name: "分组" }));

    const dialog = screen.getByRole("dialog", { name: "分组管理" });
    expect(dialog).toBeInTheDocument();
    expect(await within(dialog).findByText("研发任务")).toBeInTheDocument();
  });

  it("renders all session groups flattened like guada", async () => {
    mockClient.fetchSessionGroups.mockImplementation(async () => [
      { id: "group-1", name: "测试", sortOrder: 0 },
      { id: "group-2", name: "研发任务", sortOrder: 1 },
    ]);
    mockClient.fetchSessions.mockImplementation(async ({ groupId }: { groupId?: string | null }) => {
      if (groupId === "group-1") {
        return {
          items: [
            {
              id: "session-grouped",
              title: "今天星期几？？",
              groupId: "group-1",
              createdAt: "2026-06-28T00:00:00.000Z",
              updatedAt: "2026-06-28T00:00:00.000Z",
            },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
        };
      }
      if (groupId === "group-2") {
        return {
          items: [],
          total: 0,
          page: 1,
          pageSize: 10,
        };
      }
      return {
        items: [
          {
            id: "session-ungrouped",
            title: "指数退避重试",
            groupId: null,
            createdAt: "2026-06-28T00:00:00.000Z",
            updatedAt: "2026-06-28T00:00:00.000Z",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };
    });
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole("button", { name: "展开侧边栏" }));

    expect(await screen.findByRole("heading", { name: "测试" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "研发任务" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "任务列表" })).toBeInTheDocument();
    expect(screen.getByText("今天星期几？？")).toBeInTheDocument();
    expect(screen.getByText("指数退避重试")).toBeInTheDocument();
  });

  it("shows hover actions for each session and renames a session", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole("button", { name: "展开侧边栏" }));
    await user.click(await screen.findByRole("button", { name: "任务操作 指数退避重试" }));
    await user.click(screen.getByRole("menuitem", { name: "重命名" }));

    expect(screen.getByRole("dialog", { name: "重命名对话" })).toBeInTheDocument();
    const input = screen.getByDisplayValue("指数退避重试");
    await user.clear(input);
    await user.type(input, "新的任务名称");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(mockClient.updateSession).toHaveBeenCalledWith("session-1", { title: "新的任务名称" });
    expect(await screen.findByText("新的任务名称")).toBeInTheDocument();
  });

  it("moves a session to a selected group", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole("button", { name: "展开侧边栏" }));
    await user.click(await screen.findByRole("button", { name: "任务操作 指数退避重试" }));
    await user.click(screen.getByRole("menuitem", { name: "移动到分组" }));

    expect(screen.getByRole("dialog", { name: "请选择目标分组" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /研发任务/ }));
    await user.click(screen.getByRole("button", { name: "确定" }));

    expect(mockClient.updateSession).toHaveBeenCalledWith("session-1", { groupId: "group-1" });
    expect(screen.queryByRole("dialog", { name: "请选择目标分组" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "研发任务" })).toBeInTheDocument();
    expect(screen.getByText("指数退避重试")).toBeInTheDocument();
  });

  it("deletes a session after custom confirmation", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole("button", { name: "展开侧边栏" }));
    await user.click(await screen.findByRole("button", { name: "任务操作 指数退避重试" }));
    await user.click(screen.getByRole("menuitem", { name: "删除" }));

    expect(screen.getByRole("dialog", { name: "删除会话" })).toBeInTheDocument();
    expect(screen.getByText(/确定要删除会话/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "确定删除" }));

    expect(mockClient.deleteSession).toHaveBeenCalledWith("session-1", { deleteWorkspace: false });
    expect(screen.queryByText("指数退避重试")).not.toBeInTheDocument();
  });
});
