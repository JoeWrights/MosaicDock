import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChatWorkspace from "../pages/chat";
import WorkspaceLayout, { useWorkspaceSidebar } from "./WorkspaceLayout";

const mockClient = vi.hoisted(() => ({
  fetchSession: vi.fn(async () => ({
    id: "session-1",
    title: "指数退避重试",
    characterId: "character-1",
    modelId: "model-1",
    userId: "user-1",
    settings: {},
    createdAt: "2026-06-28T00:00:00.000Z",
    updatedAt: "2026-06-28T00:00:00.000Z",
  })),
  fetchSessionMessages: vi.fn(async () => ({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  })),
  createMessage: vi.fn(),
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

const mockChatStream = vi.hoisted(() => ({
  chat: vi.fn(async function* () {
    yield { type: "finish" as const, finishReason: "stop" };
  }),
  cancelResponse: vi.fn(),
}));

vi.mock("@mosaic-dock/api-client", () => ({
  mosaicApi: {
    client: mockClient,
    chatStream: mockChatStream,
  },
}));

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/new-session"]}>
      <Routes>
        <Route element={<WorkspaceLayout />}>
          <Route path="/new-session" element={<TestPageHeader />} />
          <Route path="/chat/:sessionId" element={<TestPageHeader />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function renderChatLayout() {
  return render(
    <MemoryRouter initialEntries={["/chat/session-1"]}>
      <Routes>
        <Route element={<WorkspaceLayout />}>
          <Route path="/chat/:sessionId" element={<ChatWorkspace />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function TestPageHeader() {
  const { toggleSidebar } = useWorkspaceSidebar();
  const location = useLocation();

  return (
    <header>
      <div data-testid="location-path">{location.pathname}</div>
      <button type="button" aria-label="展开侧边栏" onClick={toggleSidebar}>
        新建页面内容
      </button>
    </header>
  );
}

describe("WorkspaceLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.classList.remove("dark");
    localStorage.clear();
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

  it("toggles the color scheme like guada and persists the preference", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole("button", { name: "展开侧边栏" }));
    await user.click(screen.getByRole("button", { name: "暗色" }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("color-scheme")).toBe("dark");
    expect(screen.getByRole("button", { name: "亮色" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "亮色" }));

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("color-scheme")).toBe("light");
    expect(screen.getByRole("button", { name: "暗色" })).toBeInTheDocument();
  });

  it("restores the saved dark color scheme on load", async () => {
    localStorage.setItem("color-scheme", "dark");
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole("button", { name: "展开侧边栏" }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByRole("button", { name: "亮色" })).toBeInTheDocument();
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

  it("navigates to the selected session URL and highlights it", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole("button", { name: "展开侧边栏" }));
    await user.click(await screen.findByRole("button", { name: "打开会话 指数退避重试" }));

    expect(screen.getByTestId("location-path")).toHaveTextContent("/chat/session-1");
    const activeSessionButton = screen.getByRole("button", { name: "打开会话 指数退避重试" });
    const activeSessionRow = activeSessionButton.closest("div");
    expect(activeSessionRow?.className).toContain("hover:bg-slate-100");
    expect(activeSessionRow?.className).toContain("bg-slate-100");
    expect(activeSessionButton.className).not.toContain("bg-slate-100");
  });

  it("opens the guada-style sidebar from the chat session page", async () => {
    const user = userEvent.setup();
    renderChatLayout();

    await screen.findByRole("heading", { name: "指数退避重试" });
    expect(screen.queryByRole("navigation", { name: "主导航" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "展开侧边栏" }));

    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "任务列表" })).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", { hidden: true });
    expect(sidebar.className).toContain("lg:sticky");
    expect(sidebar.className).toContain("lg:w-[280px]");
    expect(sidebar.className).not.toContain("lg:fixed");
    expect(sidebar.firstElementChild?.className).toContain("w-[280px]");
    expect(sidebar.firstElementChild?.className).toContain("shrink-0");
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
