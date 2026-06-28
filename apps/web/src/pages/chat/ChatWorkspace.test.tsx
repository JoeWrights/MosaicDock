import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatWorkspace, type ChatWorkspaceApi } from ".";

const baseApi = (): ChatWorkspaceApi => ({
  client: {
    fetchSessions: vi.fn(async () => ({
      items: [
        {
          id: "session-1",
          title: "默认会话",
          characterId: "character-1",
          modelId: "model-1",
          userId: "user-1",
          settings: {},
          createdAt: "2026-06-27T09:00:00.000Z",
          updatedAt: "2026-06-27T09:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
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
  },
  chatStream: {
    chat: vi.fn(async function* () {
      yield { type: "text" as const, content: "这是新的 React 前端。" };
      yield { type: "finish" as const, finishReason: "stop" };
    }),
    cancelResponse: vi.fn(),
  },
});

describe("ChatWorkspace", () => {
  it("loads sessions and messages", async () => {
    const { container } = render(<ChatWorkspace api={baseApi()} />);

    expect((await screen.findAllByText("默认会话")).length).toBeGreaterThan(0);
    expect(await screen.findByText("你好，我是 Mosaic Dock。")).toBeInTheDocument();
    expect(container.querySelector('[class*="ant-"]')).toBeNull();
  });

  it("sends a message and appends streamed assistant text", async () => {
    const api = baseApi();
    const user = userEvent.setup();
    render(<ChatWorkspace api={api} />);

    await user.type(await screen.findByPlaceholderText("输入消息，按 Enter 发送"), "介绍一下项目");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(api.client.createMessage).toHaveBeenCalledWith("session-1", "介绍一下项目");
    });
    expect(await screen.findByText("这是新的 React 前端。")).toBeInTheDocument();
  });
});
