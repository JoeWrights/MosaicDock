import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CharactersPage, type CharactersPageApi } from ".";
import { WorkspaceSidebarContext } from "../../layouts/WorkspaceLayout";

function createApi(): CharactersPageApi {
  const deleteCharacter =
    vi.fn(async () => ({ success: true })) as unknown as CharactersPageApi["client"]["deleteCharacter"];

  return {
    client: {
      fetchCharacter: vi.fn(async (characterId: string) => ({
        id: characterId,
        title: "智能助手",
        description: "一个友好、专业的 AI 助手，可以帮助你解答各种问题。",
        avatarUrl: "/avatars/default.jpg",
        type: "system" as const,
        isActive: true,
        groupId: null,
        userId: "user-1",
        createdAt: "2026-06-28T00:00:00.000Z",
        updatedAt: "2026-06-28T00:00:00.000Z",
        settings: {
          systemPrompt: "你是一个友好的助手",
          useUserPrompt: false,
          memory: { maxMemoryLength: 20, summaryMode: "memory_sync" as const },
        },
      })),
      fetchCharacters: vi.fn(async ({ groupId } = {}) => ({
        items:
          groupId === "group-1"
            ? [
                {
                  id: "character-2",
                  title: "产品经理",
                  description: "帮助拆解需求和产品方案",
                  type: "public" as const,
                  isActive: true,
                  groupId: "group-1",
                  userId: "user-1",
                  createdAt: "2026-06-28T00:00:00.000Z",
                  updatedAt: "2026-06-28T00:00:00.000Z",
                },
              ]
            : [
                {
                  id: "character-1",
                  title: "智能助手",
                  description: "一个友好、专业的 AI 助手，可以帮助你解答各种问题。",
                  systemPrompt: "你是一个友好的助手",
                  type: "system" as const,
                  isActive: true,
                  groupId: null,
                  userId: "user-1",
                  createdAt: "2026-06-28T00:00:00.000Z",
                  updatedAt: "2026-06-28T00:00:00.000Z",
                },
                {
                  id: "character-2",
                  title: "产品经理",
                  description: "帮助拆解需求和产品方案",
                  type: "public" as const,
                  isActive: true,
                  groupId: "group-1",
                  userId: "user-1",
                  createdAt: "2026-06-28T00:00:00.000Z",
                  updatedAt: "2026-06-28T00:00:00.000Z",
                },
              ],
        total: groupId === "group-1" ? 1 : 2,
        page: 1,
        pageSize: 20,
      })),
      fetchCharacterGroups: vi.fn(async () => [
        {
          id: "group-1",
          name: "产品",
          userId: "user-1",
          sortOrder: 0,
          createdAt: "2026-06-28T00:00:00.000Z",
          updatedAt: "2026-06-28T00:00:00.000Z",
        },
      ]),
      createCharacterGroup: vi.fn(async (data) => ({
        id: "group-new",
        name: data.name,
        userId: "user-1",
        sortOrder: 1,
        createdAt: "2026-06-28T00:00:00.000Z",
        updatedAt: "2026-06-28T00:00:00.000Z",
      })),
      fetchModels: vi.fn(async () => ({
        items: [
          {
            id: "provider-1",
            name: "硅基流动",
            apiKeySet: true,
            isActive: true,
            models: [
              {
                id: "model-1",
                modelName: "DeepSeek-V3.2",
                modelType: "text",
                providerId: "provider-1",
                isActive: true,
              },
            ],
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      })),
      fetchSkills: vi.fn(async () => ({
          items: [
            {
              id: "skill-1",
              name: "需求分析",
              description: "分析需求",
              enabled: true,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        })) as unknown as CharactersPageApi["client"]["fetchSkills"],
      fetchMcpServers: vi.fn(async () => ({
        items: [
          {
            id: "mcp-1",
            name: "文件系统",
            description: "文件读写",
            enabled: true,
          },
        ],
        size: 1,
      })) as unknown as CharactersPageApi["client"]["fetchMcpServers"],
      fetchCharacterTools: vi.fn(async () => ({
        characterId: "__new_character__",
        plugins: [
          {
            pluginId: "local-search",
            displayName: "本地搜索",
            description: "搜索本地内容",
            tools: [
              { name: "search", description: "搜索", enabled: true },
              { name: "read", description: "读取", enabled: true },
            ],
          },
        ],
      })),
      createCharacter: vi.fn(async (data) => ({
        id: "character-new",
        title: data.title,
        description: data.description,
        type: "private" as const,
        isActive: true,
        groupId: data.groupId,
        userId: "user-1",
        createdAt: "2026-06-28T00:00:00.000Z",
        updatedAt: "2026-06-28T00:00:00.000Z",
        settings: data.settings,
      })),
      updateCharacter: vi.fn(async (_id, data) => ({
        id: "character-1",
        title: data.title ?? "智能助手",
        description: data.description,
        type: "system" as const,
        isActive: true,
        groupId: data.groupId,
        userId: "user-1",
        createdAt: "2026-06-28T00:00:00.000Z",
        updatedAt: "2026-06-28T00:00:00.000Z",
        settings: data.settings,
      })),
      uploadCharacterAvatar: vi.fn(async () => ({ url: "/uploads/avatar.jpg" })),
      deleteCharacter,
      createSession: vi.fn(async (data) => ({
        id: "session-new",
        title: data.title ?? "智能助手",
        characterId: data.characterId,
        modelId: data.modelId ?? "model-1",
        userId: "user-1",
        settings: {},
        createdAt: "2026-06-28T00:00:00.000Z",
        updatedAt: "2026-06-28T00:00:00.000Z",
      })),
    },
  };
}

function renderCharactersPage(api: CharactersPageApi = createApi(), initialPath = "/characters/assistants") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/characters/:tab" element={<CharactersPage api={api} />} />
        <Route path="/chat/:sessionId" element={<LocationStateProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderCharactersPageWithSidebar(api: CharactersPageApi = createApi()) {
  function SidebarHarness() {
    const [sidebarOpen, setSidebarOpen] = useState(true);

    return (
      <WorkspaceSidebarContext.Provider
        value={{
          sidebarOpen,
          toggleSidebar: () => setSidebarOpen((current) => !current),
          closeSidebar: () => setSidebarOpen(false),
        }}
      >
        <CharactersPage api={api} />
      </WorkspaceSidebarContext.Provider>
    );
  }

  return render(
    <MemoryRouter initialEntries={["/characters/assistants"]}>
      <Routes>
        <Route path="/characters/:tab" element={<SidebarHarness />} />
      </Routes>
    </MemoryRouter>,
  );
}

function LocationStateProbe() {
  const location = useLocation();

  return <span data-testid="location-path">{location.pathname}</span>;
}

async function chooseOption(user: ReturnType<typeof userEvent.setup>, label: string, optionName: string) {
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(screen.getByRole("option", { name: optionName }));
}

describe("CharactersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders guada-style assistant cards and group filters", async () => {
    const api = createApi();
    renderCharactersPage(api);

    expect(screen.getByRole("heading", { name: "助手" })).toBeInTheDocument();
    expect(await screen.findByTestId("character-card-character-1")).toBeInTheDocument();
    expect(screen.getByTestId("character-card-character-2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全部" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "产品" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建助手" })).toBeInTheDocument();
  });

  it("keeps the page title size aligned with the new session header", () => {
    renderCharactersPage(createApi());

    const heading = screen.getByRole("heading", { name: "助手" });

    expect(heading).toHaveClass("text-sm");
    expect(heading).toHaveClass("font-semibold");
    expect(heading.className).not.toContain("text-xl");
  });

  it("uses the shared page header sidebar toggle like the new session route", async () => {
    const user = userEvent.setup();
    renderCharactersPageWithSidebar();

    expect(screen.getByRole("heading", { name: "助手" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "收起侧边栏" }));

    expect(screen.getByRole("button", { name: "展开侧边栏" })).toBeInTheDocument();
  });

  it("uses the same horizontal page padding as the new session route", () => {
    const api = createApi();
    const { container } = renderCharactersPage(api);

    expect(container.firstElementChild?.className).toContain("px-5");
    expect(container.firstElementChild?.className).not.toContain("py-5");
    expect(container.firstElementChild?.className).not.toContain("lg:px-9");
  });

  it("filters assistants by group", async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderCharactersPage(api);

    await user.click(await screen.findByRole("button", { name: "产品" }));

    await waitFor(() => {
      expect(api.client.fetchCharacters).toHaveBeenLastCalledWith({
        skip: 0,
        limit: 60,
        groupId: "group-1",
      });
    });
    expect(await screen.findByTestId("character-card-character-2")).toBeInTheDocument();
    expect(screen.queryByTestId("character-card-character-1")).not.toBeInTheDocument();
  });

  it("creates a new assistant group and selects it", async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderCharactersPage(api);

    await user.click(await screen.findByRole("button", { name: "新建分组" }));
    await user.type(screen.getByLabelText("分组名称"), "运营");
    await user.click(screen.getByRole("button", { name: "确定" }));

    await waitFor(() => {
      expect(api.client.createCharacterGroup).toHaveBeenCalledWith({ name: "运营" });
      expect(api.client.fetchCharacters).toHaveBeenLastCalledWith({
        skip: 0,
        limit: 60,
        groupId: "group-new",
      });
    });
    expect(screen.getByRole("button", { name: "运营" })).toBeInTheDocument();
  });

  it("creates and edits an assistant from the basic settings dialog", async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderCharactersPage(api);

    await user.click(await screen.findByRole("button", { name: "新建助手" }));
    expect(await screen.findByRole("button", { name: /基础/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /提示词/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /模型/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /记忆/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /本地工具/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /MCP 工具/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Skills/ })).toBeInTheDocument();

    await user.type(screen.getByLabelText("角色标题"), "需求分析师");
    await user.type(screen.getByLabelText("角色描述"), "帮助梳理业务需求");
    await chooseOption(user, "分组设置", "产品");
    await user.click(screen.getByRole("button", { name: /提示词/ }));
    await user.type(screen.getByLabelText("系统提示词"), "你是需求分析师");
    await user.click(screen.getByRole("button", { name: /模型/ }));
    await chooseOption(user, "模型选择", "硅基流动 / DeepSeek-V3.2");
    await user.click(screen.getByLabelText("覆盖模型参数"));
    await user.clear(screen.getByLabelText("Temperature"));
    await user.type(screen.getByLabelText("Temperature"), "0.7");
    await user.click(screen.getByRole("button", { name: /MCP 工具/ }));
    await user.click(screen.getByLabelText(/文件系统/));
    await user.click(screen.getByRole("button", { name: /Skills/ }));
    await user.click(screen.getByLabelText(/需求分析/));
    await user.click(screen.getByRole("button", { name: "应用全部设置" }));

    await waitFor(() => {
      expect(api.client.createCharacter).toHaveBeenCalledWith({
        title: "需求分析师",
        description: "帮助梳理业务需求",
        groupId: "group-1",
        modelId: "model-1",
        settings: expect.objectContaining({
          systemPrompt: "你是需求分析师",
          overrideModelParams: true,
          modelTemperature: 0.7,
          mcpServers: ["mcp-1"],
          skills: { "skill-1": true },
        }),
      });
    });

    await user.click(screen.getByRole("button", { name: "角色设置 智能助手" }));
    await screen.findByRole("button", { name: /基础/ });
    await user.clear(screen.getByLabelText("角色标题"));
    await user.type(screen.getByLabelText("角色标题"), "智能助手 Pro");
    await user.click(screen.getByRole("button", { name: "应用全部设置" }));

    await waitFor(() => {
      expect(api.client.updateCharacter).toHaveBeenCalledWith("character-1", {
        title: "智能助手 Pro",
        description: "一个友好、专业的 AI 助手，可以帮助你解答各种问题。",
        groupId: null,
        modelId: null,
        settings: expect.objectContaining({
          systemPrompt: "你是一个友好的助手",
          memory: expect.objectContaining({ summaryMode: "memory_sync" }),
        }),
      });
    });
  });

  it("animates the assistant modal overlay and panel", async () => {
    const user = userEvent.setup();
    renderCharactersPage(createApi());

    await user.click(await screen.findByRole("button", { name: "新建助手" }));
    const dialog = await screen.findByRole("dialog", { name: "新建助手" });

    expect(dialog.parentElement).toHaveClass("transition-opacity");
    expect(dialog).toHaveClass("transition-all");
    expect(dialog).toHaveClass("duration-200");
  });

  it("deletes assistants after confirmation", async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderCharactersPage(api);

    const card = await screen.findByTestId("character-card-character-1");
    await user.click(within(card).getByRole("button", { name: "删除 智能助手" }));
    await user.click(screen.getByRole("button", { name: "确定删除" }));

    await waitFor(() => {
      expect(api.client.deleteCharacter).toHaveBeenCalledWith("character-1");
    });
    expect(screen.queryByTestId("character-card-character-1")).not.toBeInTheDocument();
  });

  it("uploads a cropped avatar after creating an assistant", async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderCharactersPage(api);

    await user.click(await screen.findByRole("button", { name: "新建助手" }));
    await screen.findByRole("button", { name: /基础/ });
    await user.upload(
      screen.getByLabelText("上传头像文件"),
      new File(["avatar"], "avatar.png", { type: "image/png" }),
    );

    expect(screen.getByRole("dialog", { name: "裁剪头像" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认裁剪" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "裁剪头像" })).not.toBeInTheDocument();
    });
    await user.type(screen.getByLabelText("角色标题"), "头像助手");
    await user.click(screen.getByRole("button", { name: "应用全部设置" }));

    await waitFor(() => {
      expect(api.client.createCharacter).toHaveBeenCalledWith(
        expect.objectContaining({ title: "头像助手" }),
      );
      expect(api.client.uploadCharacterAvatar).toHaveBeenCalledWith(
        "character-new",
        expect.any(File),
      );
    });
  });

  it("creates a chat session when using an assistant", async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderCharactersPage(api);

    const card = await screen.findByTestId("character-card-character-1");
    await user.click(within(card).getByRole("button", { name: "使用此角色 智能助手" }));

    await waitFor(() => {
      expect(api.client.createSession).toHaveBeenCalledWith({
        characterId: "character-1",
        title: "智能助手",
      });
    });
    expect(await screen.findByTestId("location-path")).toHaveTextContent("/chat/session-new");
  });
});
