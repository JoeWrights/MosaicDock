import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ChatWorkspace, type ChatWorkspaceApi } from ".";

type TestChatWorkspaceApi = ChatWorkspaceApi & {
  client: Record<string, ReturnType<typeof vi.fn>>;
};

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
    fetchMessageContentToolDetails: vi.fn(async () => ({ toolCalls: [], toolCallsResponse: [] })),
    updateMessageActiveContent: vi.fn(async () => ({ success: true })),
    updateMessage: vi.fn(async () => ({ success: true })),
    deleteMessage: vi.fn(async () => ({ success: true })),
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
            {
              id: "model-2",
              modelName: "DeepSeek-R1",
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
  },
  chatStream: {
    chat: vi.fn(async function* () {
      yield { type: "text" as const, content: "这是新的 React 前端。" };
      yield { type: "finish" as const, finishReason: "stop" };
    }),
    cancelResponse: vi.fn(),
  },
} as unknown as TestChatWorkspaceApi);

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

  it("renders streamed reasoning, tool calls, markdown content, and token usage", async () => {
    const api = baseApi();
    api.chatStream.chat = vi.fn(async function* () {
      yield {
        type: "create" as const,
        messageId: "assistant-real",
        turnsId: "turn-1",
        contentId: "content-real",
        modelName: "DeepSeek-V3.2",
      };
      yield { type: "think" as const, reasoningContent: "先分析需求。" };
      yield {
        type: "tool_call" as const,
        toolCalls: [
          {
            name: "file.write",
            metadata: { displayMessage: { action: "已写入文件", args: "README.md" } },
          },
        ],
      };
      yield {
        type: "tool_calls_response" as const,
        toolCallsResponse: [{ name: "file.write", content: "ok", toolCallId: "tool-1" }],
        usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
      };
      yield { type: "text" as const, content: "## 完成\n\n```ts\nconst ok = true;\n```" };
      yield {
        type: "finish" as const,
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      };
    });
    const user = userEvent.setup();
    renderChat(api);

    await user.type(await screen.findByPlaceholderText("按 / 使用技能，Shift+Enter 换行"), "开始");
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("button", { name: /已深度思考/ })).toBeInTheDocument();
    expect(await screen.findByText("已写入文件")).toBeInTheDocument();
    expect(await screen.findByText("完成")).toBeInTheDocument();
    expect(await screen.findByText("ts")).toBeInTheDocument();
    expect(await screen.findByText("Prompt 10")).toBeInTheDocument();
    expect(await screen.findByText("Completion 20")).toBeInTheDocument();
    expect(await screen.findByText("Total 30")).toBeInTheDocument();
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

  it("uses new-session style thinking effort and model selector interactions", async () => {
    const api = baseApi();
    const user = userEvent.setup();
    renderChat(api);

    await user.click(await screen.findByRole("button", { name: "不思考" }));

    expect(screen.getByText("思考强度")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /低强度\s*low/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /中等强度\s*medium/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /中等强度\s*medium/ }));
    expect(screen.getByRole("button", { name: "中等强度" })).toBeInTheDocument();
    expect(screen.queryByText("思考强度")).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /DeepSeek-V3\.2/ }));
    expect(screen.getByPlaceholderText("搜索模型...")).toBeInTheDocument();
    expect(screen.getByText("硅基流动")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /DeepSeek-R1/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /DeepSeek-R1/ }));
    expect(screen.getByRole("button", { name: /DeepSeek-R1/ })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("搜索模型...")).not.toBeInTheDocument();
  });

  it("uses new-session style composer tool icons", async () => {
    const api = baseApi();
    renderChat(api);

    expect(await screen.findByRole("button", { name: "不思考" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加图片" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上传文件" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "知识库" })).toBeInTheDocument();
    expect(screen.queryByText("图片")).not.toBeInTheDocument();
    expect(screen.queryByText("附件")).not.toBeInTheDocument();
    expect(screen.queryByText("搜索")).not.toBeInTheDocument();
  });

  it("shows tooltips for composer tool icons on hover", async () => {
    const api = baseApi();
    const user = userEvent.setup();
    renderChat(api);

    await user.hover(await screen.findByRole("button", { name: "添加图片" }));
    expect(screen.getByRole("tooltip", { name: "添加图片" })).toBeInTheDocument();

    await user.hover(screen.getByRole("button", { name: "上传文件" }));
    expect(screen.getByRole("tooltip", { name: "上传文件" })).toBeInTheDocument();

    await user.hover(screen.getByRole("button", { name: "知识库" }));
    expect(screen.getByRole("tooltip", { name: "知识库" })).toBeInTheDocument();
  });

  it("wires tool details, version switching, continue, regenerate, and delete actions", async () => {
    const api = baseApi();
    api.client.fetchSessionMessages = vi.fn(async () => ({
      items: [
        {
          id: "message-1",
          role: "assistant" as const,
          currentTurnsId: "turn-1",
          contents: [
            {
              id: "content-1",
              turnsId: "turn-1",
              content: "当前版本",
              state: { isStreaming: false },
              metadata: {
                finishReason: "max_iterations_reached",
                toolCalls: [{ name: "file.write", metadata: { displayMessage: "已写入文件 README.md" } }],
              },
            },
            {
              id: "content-2",
              turnsId: "turn-2",
              content: "第二版本",
              state: { isStreaming: false },
            },
          ],
          state: { isStreaming: false },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    }));
    api.client.fetchMessageContentToolDetails = vi.fn(async () => ({
      toolCalls: [{ name: "file.write", arguments: { path: "README.md" } }],
      toolCallsResponse: [{ name: "file.write", content: "ok", toolCallId: "tool-1" }],
    }));
    api.chatStream.chat = vi.fn(async function* () {
      yield { type: "finish" as const, finishReason: "stop" };
    });
    const user = userEvent.setup();
    renderChat(api);

    await user.click(await screen.findByRole("button", { name: /工具调用/ }));
    expect(await screen.findByText("工具调用详情")).toBeInTheDocument();
    expect(api.client.fetchMessageContentToolDetails).toHaveBeenCalledWith("content-1");

    await user.click(await screen.findByRole("button", { name: "继续执行" }));
    expect(api.chatStream.chat).toHaveBeenCalledWith(expect.objectContaining({ regenerationMode: "resume" }));

    await user.click(screen.getByRole("button", { name: "下一个版本" }));
    expect(api.client.updateMessageActiveContent).toHaveBeenCalledWith("content-2", "message-1");

    await user.click(screen.getByRole("button", { name: /重新生成/ }));
    expect(api.chatStream.chat).toHaveBeenCalledWith(expect.objectContaining({ regenerationMode: "multi_version" }));

    await user.click(screen.getByRole("button", { name: "更多操作" }));
    await user.click(screen.getByRole("menuitem", { name: "编辑内容" }));
    const editDialog = screen.getByRole("dialog", { name: "编辑内容" });
    const editInput = within(editDialog).getByRole("textbox", { name: "消息内容" });
    await user.clear(editInput);
    await user.type(editInput, "编辑后的内容");
    await user.click(within(editDialog).getByRole("button", { name: "保存" }));
    expect(api.client.updateMessage).toHaveBeenCalledWith("message-1", { content: "编辑后的内容" });

    await user.click(screen.getByRole("button", { name: "更多操作" }));
    await user.click(screen.getByRole("menuitem", { name: "删除消息" }));
    expect(api.client.deleteMessage).not.toHaveBeenCalled();
    const deleteDialog = screen.getByRole("dialog", { name: "删除消息" });
    expect(within(deleteDialog).getByText("确定要删除这条回答吗？此操作不可撤销。")).toBeInTheDocument();
    await user.click(within(deleteDialog).getByRole("button", { name: "确认" }));
    expect(api.client.deleteMessage).toHaveBeenCalledWith("message-1");
  });
});
