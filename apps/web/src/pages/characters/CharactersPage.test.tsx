import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CharactersPage, type CharactersPageApi } from ".";

function createApi(): CharactersPageApi {
  const deleteCharacter =
    vi.fn(async () => ({ success: true })) as unknown as CharactersPageApi["client"]["deleteCharacter"];

  return {
    client: {
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
      createCharacter: vi.fn(async (data) => ({
        id: "character-new",
        title: data.title,
        description: data.description,
        systemPrompt: data.systemPrompt,
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
        systemPrompt: data.systemPrompt,
        type: "system" as const,
        isActive: true,
        groupId: data.groupId,
        userId: "user-1",
        createdAt: "2026-06-28T00:00:00.000Z",
        updatedAt: "2026-06-28T00:00:00.000Z",
      })),
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

function LocationStateProbe() {
  const location = useLocation();

  return <span data-testid="location-path">{location.pathname}</span>;
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

  it("creates and edits an assistant from the basic settings dialog", async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderCharactersPage(api);

    await user.click(await screen.findByRole("button", { name: "新建助手" }));
    await user.type(screen.getByLabelText("名称"), "需求分析师");
    await user.type(screen.getByLabelText("描述"), "帮助梳理业务需求");
    await user.type(screen.getByLabelText("系统提示词"), "你是需求分析师");
    await user.selectOptions(screen.getByLabelText("分组"), "group-1");
    await user.click(screen.getByRole("button", { name: "保存设置" }));

    await waitFor(() => {
      expect(api.client.createCharacter).toHaveBeenCalledWith({
        title: "需求分析师",
        description: "帮助梳理业务需求",
        systemPrompt: "你是需求分析师",
        groupId: "group-1",
      });
    });

    await user.click(screen.getByRole("button", { name: "角色设置 智能助手" }));
    await user.clear(screen.getByLabelText("名称"));
    await user.type(screen.getByLabelText("名称"), "智能助手 Pro");
    await user.click(screen.getByRole("button", { name: "保存设置" }));

    await waitFor(() => {
      expect(api.client.updateCharacter).toHaveBeenCalledWith("character-1", {
        title: "智能助手 Pro",
        description: "一个友好、专业的 AI 助手，可以帮助你解答各种问题。",
        systemPrompt: "你是一个友好的助手",
        groupId: null,
      });
    });
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
