import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ChatWorkspace, type ChatWorkspaceApi } from ".";

interface TestChatWorkspaceApi extends ChatWorkspaceApi {
  client: ChatWorkspaceApi["client"] & {
    fetchWorkspaceTree: ReturnType<typeof vi.fn>;
    fetchWorkspaceChildren: ReturnType<typeof vi.fn>;
  };
}

const baseApi = (): TestChatWorkspaceApi => ({
  client: {
    fetchSession: vi.fn(async () => ({
      id: "session-1",
      title: "默认会话",
      characterId: "character-1",
      modelId: "model-1",
      userId: "user-1",
      settings: {},
      createdAt: "2026-06-27T09:00:00.000Z",
      updatedAt: "2026-06-27T09:00:00.000Z",
    })),
    fetchSessionMessages: vi.fn(async () => ({
      items: [
        {
          id: "message-1",
          role: "assistant" as const,
          contents: [
            {
              id: "content-1",
              content: "你好，我是 Mosaic Dock。",
              state: { isStreaming: false },
            },
          ],
          state: { isStreaming: false },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    })),
    createMessage: vi.fn(async () => ({
      id: "message-2",
      role: "user" as const,
      contents: [
        {
          id: "content-2",
          content: "介绍一下项目",
          state: { isStreaming: false },
        },
      ],
      state: { isStreaming: false },
    })),
    fetchWorkspaceTree: vi.fn(async () => ({
      tree: [
        {
          name: ".guada",
          path: ".guada",
          isDirectory: true,
          hasChildren: true,
          children: [],
        },
        {
          name: "src",
          path: "src",
          isDirectory: true,
          hasChildren: true,
          children: [],
        },
        {
          name: "README.md",
          path: "README.md",
          isDirectory: false,
        },
      ],
    })),
    fetchWorkspaceChildren: vi.fn(async () => ({
      children: [
        {
          name: "index.tsx",
          path: "src/index.tsx",
          isDirectory: false,
        },
      ],
    })),
  },
  chatStream: {
    chat: vi.fn(async function* () {
      yield { type: "text" as const, content: "这是新的 React 前端。" };
      yield { type: "finish" as const, finishReason: "stop" };
    }),
    cancelResponse: vi.fn(),
  },
});

function renderChat(api: ChatWorkspaceApi = baseApi(), initialPath = "/chat/session-1") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/chat/:sessionId" element={<ChatWorkspace api={api} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ChatWorkspace", () => {
  it("loads the route session and messages without an inner session sidebar", async () => {
    const api = baseApi();
    const { container } = renderChat(api);

    expect(await screen.findByRole("heading", { name: "默认会话" })).toBeInTheDocument();
    expect(await screen.findByText("你好，我是 Mosaic Dock。")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "会话" })).not.toBeInTheDocument();
    expect(api.client.fetchSession).toHaveBeenCalledWith("session-1");
    expect(api.client.fetchSessionMessages).toHaveBeenCalledWith("session-1", { limit: 50 });
    expect(container.querySelector('[class*="ant-"]')).toBeNull();
  });

  it("sends a message and appends streamed assistant text", async () => {
    const api = baseApi();
    const user = userEvent.setup();
    renderChat(api);

    await user.type(await screen.findByPlaceholderText("按 / 使用技能，Shift+Enter 换行"), "介绍一下项目");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(api.client.createMessage).toHaveBeenCalledWith("session-1", "介绍一下项目");
    });
    expect(await screen.findByText("这是新的 React 前端。")).toBeInTheDocument();
  });

  it("loads and renders the workspace tree in the right panel", async () => {
    const api = baseApi();
    renderChat(api);

    expect(await screen.findByRole("heading", { name: "工作目录" })).toBeInTheDocument();
    expect(await screen.findByText(".guada")).toBeInTheDocument();
    expect(await screen.findByText("README.md")).toBeInTheDocument();
    expect(api.client.fetchWorkspaceTree).toHaveBeenCalledWith("session-1");
  });

  it("loads workspace children when expanding a directory", async () => {
    const api = baseApi();
    const user = userEvent.setup();
    renderChat(api);

    await user.click(await screen.findByRole("button", { name: "展开 src" }));

    await waitFor(() => {
      expect(api.client.fetchWorkspaceChildren).toHaveBeenCalledWith("session-1", "src");
    });
    expect(await screen.findByText("index.tsx")).toBeInTheDocument();
  });
});
