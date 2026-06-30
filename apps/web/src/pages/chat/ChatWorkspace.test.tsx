import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ChatWorkspace, type ChatWorkspaceApi } from ".";

type TestChatWorkspaceApi = {
  client: Record<string, ReturnType<typeof vi.fn>>;
  chatStream: Record<string, ReturnType<typeof vi.fn>>;
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
    fetchWorkspaceFile: vi.fn(async () => ({
      path: "README.md",
      name: "README.md",
      extension: ".md",
      size: 42,
      content: "# Mosaic Dock\n\n项目说明",
      mimeType: "text/markdown",
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

function renderChat(
  api: TestChatWorkspaceApi = baseApi(),
  initialPath: string | { pathname: string; state: unknown } = "/chat/session-1",
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/chat/:sessionId" element={<ChatWorkspace api={api as unknown as ChatWorkspaceApi} />} />
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

  it("does not show the new-session empty prompt for an empty team session", async () => {
    const api = baseApi();
    api.client.fetchSession.mockImplementation(async () => ({
      id: "session-team",
      title: "测试团队",
      characterId: "",
      teamId: "team-1",
      sessionType: "team",
      modelId: "model-1",
      userId: "user-1",
      settings: {},
      createdAt: "2026-06-27T09:00:00.000Z",
      updatedAt: "2026-06-27T09:00:00.000Z",
    }));
    api.client.fetchSessionMessages.mockImplementation(async () => ({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    }));

    renderChat(api, "/chat/session-team");

    expect(await screen.findByRole("heading", { name: "测试团队" })).toBeInTheDocument();
    expect(screen.queryByText("选择会话后开始对话")).not.toBeInTheDocument();
  });

  it("keeps the chat shell fixed while the message list scrolls internally", async () => {
    const { container } = renderChat();

    expect(await screen.findByRole("heading", { name: "默认会话" })).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain("h-screen");
    expect(container.firstElementChild?.className).toContain("overflow-hidden");
    expect(container.firstElementChild?.className).not.toContain("min-h-screen");
    expect(container.querySelector(".min-h-0.flex-1.overflow-auto")).toBeInTheDocument();
  });

  it("continues the first answer from a new-session pending user message", async () => {
    const api = baseApi();
    renderChat(api, {
      pathname: "/chat/session-new",
      state: {
        pendingUserMessage: {
          id: "message-new",
          role: "user",
          contents: [
            {
              id: "content-new",
              content: "现在几点了？",
              state: { isStreaming: false },
            },
          ],
          state: { isStreaming: false },
        },
      },
    });

    expect(await screen.findByText("现在几点了？")).toBeInTheDocument();
    expect(await screen.findByText("这是新的 React 前端。")).toBeInTheDocument();
    expect(api.chatStream.chat).toHaveBeenCalledWith({
      sessionId: "session-new",
      userMessage: { content: "现在几点了？" },
    });
  });

  it("sends a message and appends streamed assistant text", async () => {
    const api = baseApi();
    const user = userEvent.setup();
    renderChat(api);

    await user.type(await screen.findByPlaceholderText("按 / 使用技能，Shift+Enter 换行"), "介绍一下项目");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(api.chatStream.chat).toHaveBeenCalledWith({
        sessionId: "session-1",
        userMessage: { content: "介绍一下项目" },
      });
    });
    expect(api.client.createMessage).not.toHaveBeenCalled();
    expect(await screen.findByText("这是新的 React 前端。")).toBeInTheDocument();
  });

  it("fills the composer instead of sending when generating from a user message", async () => {
    const api = baseApi();
    api.client.fetchSessionMessages.mockImplementation(async () => ({
      items: [
        {
          id: "message-user-1",
          role: "user" as const,
          contents: [
            {
              id: "content-user-1",
              content: "介绍一下项目",
              state: { isStreaming: false },
            },
          ],
          state: { isStreaming: false },
        },
        {
          id: "message-assistant-1",
          role: "assistant" as const,
          parentId: "message-user-1",
          contents: [
            {
              id: "content-assistant-1",
              content: "你好，我是 Mosaic Dock。",
              state: { isStreaming: false },
            },
          ],
          state: { isStreaming: false },
        },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    }));
    const user = userEvent.setup();
    renderChat(api);

    await user.click(await screen.findByRole("button", { name: "继续生成" }));

    expect(screen.getByText("正在编辑消息")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("按 / 使用技能，Shift+Enter 换行")).toHaveValue("介绍一下项目");
    expect(api.chatStream.chat).not.toHaveBeenCalled();
  });

  it("auto scrolls to the latest message while the assistant answer streams", async () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    const api = baseApi();
    const user = userEvent.setup();

    try {
      renderChat(api);

      await user.type(await screen.findByPlaceholderText("按 / 使用技能，Shift+Enter 换行"), "继续介绍");
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(screen.getByText("这是新的 React 前端。")).toBeInTheDocument();
      });
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "end", behavior: "smooth" });
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
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
      yield { type: "text" as const, content: "我先查看项目状态。" };
      yield {
        type: "tool_call" as const,
        toolCalls: [
          {
            index: 0,
            name: "file.write",
            arguments: "{\"path\":\"README",
            metadata: { displayMessage: { action: "已写入文件", args: "README.md" } },
          },
        ],
      };
      yield {
        type: "tool_call" as const,
        toolCalls: [
          {
            index: 0,
            arguments: ".md\"}",
            metadata: { displayMessage: { action: "", args: "" } },
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

    expect(await screen.findByText("我先查看项目状态。")).toBeInTheDocument();
    expect(await screen.findByText("已写入文件")).toBeInTheDocument();
    expect(await screen.findByText("完成")).toBeInTheDocument();
    expect(await screen.findByText("ts")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /工具调用/ })).toHaveLength(1);
    expect(await screen.findByText("Prompt 10")).toBeInTheDocument();
    expect(await screen.findByText("Completion 20")).toBeInTheDocument();
    expect(await screen.findByText("Total 30")).toBeInTheDocument();
    const intro = screen.getByText("我先查看项目状态。");
    const tool = screen.getByText("已写入文件");
    const answer = screen.getByText("完成");
    expect(intro.compareDocumentPosition(tool)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(tool.compareDocumentPosition(answer)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
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

  it("opens a workspace file preview and returns to the tree", async () => {
    const api = baseApi();
    const user = userEvent.setup();
    renderChat(api);

    await user.click(await screen.findByRole("button", { name: "文件 README.md" }));

    await waitFor(() => {
      expect(api.client.fetchWorkspaceFile).toHaveBeenCalledWith("session-1", "README.md");
    });
    expect(screen.getByRole("heading", { name: "README.md" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mosaic Dock" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "文件 README.md" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "关闭文件预览" }));

    expect(screen.getByRole("heading", { name: "工作目录" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "文件 README.md" })).toBeInTheDocument();
  });

  it("renders markdown files in preview mode and switches to source", async () => {
    const api = baseApi();
    const user = userEvent.setup();
    renderChat(api);

    await user.click(await screen.findByRole("button", { name: "文件 README.md" }));

    expect(await screen.findByRole("heading", { name: "Mosaic Dock" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "预览" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "源码" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("# Mosaic Dock")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "源码" }));

    expect(screen.getByRole("button", { name: "预览" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "源码" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/# Mosaic Dock/)).toBeInTheDocument();
  });

  it("highlights source code previews based on the file extension", async () => {
    const api = baseApi();
    api.client.fetchWorkspaceFile.mockResolvedValueOnce({
      path: "src/index.tsx",
      name: "index.tsx",
      extension: ".tsx",
      size: 48,
      content: "export function App() {\n  return <main>Hello</main>;\n}",
      mimeType: "text/typescript",
    });
    const user = userEvent.setup();
    const { container } = renderChat(api);

    await user.click(await screen.findByRole("button", { name: "展开 src" }));
    await user.click(await screen.findByRole("button", { name: "文件 index.tsx" }));

    await waitFor(() => {
      expect(api.client.fetchWorkspaceFile).toHaveBeenCalledWith("session-1", "src/index.tsx");
    });
    expect(container.querySelector("pre.hljs.language-typescript code")).not.toBeNull();
    expect(container.querySelector(".hljs-keyword")?.textContent).toBe("export");
  });

  it("resizes the workspace panel with a draggable divider and persists the width", async () => {
    localStorage.removeItem("chat-workspace-panel-width");
    const user = userEvent.setup();
    renderChat();

    expect(await screen.findByRole("heading", { name: "工作目录" })).toBeInTheDocument();
    expect(screen.getByTestId("workspace-panel")).toHaveStyle({ width: "280px" });

    const divider = screen.getByRole("separator", { name: "调整工作目录宽度" });
    fireEvent.pointerDown(divider, { clientX: 800 });
    fireEvent.pointerMove(document, { clientX: 740 });
    fireEvent.pointerUp(document);

    expect(screen.getByTestId("workspace-panel")).toHaveStyle({ width: "340px" });
    expect(localStorage.getItem("chat-workspace-panel-width")).toBe("340");

    await user.click(screen.getByRole("button", { name: "收起工作目录" }));
    expect(screen.queryByRole("separator", { name: "调整工作目录宽度" })).not.toBeInTheDocument();
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

  it("shortens prefixed model names only in the selected chat model button", async () => {
    const api = baseApi();
    const user = userEvent.setup();
    vi.mocked(api.client.fetchModels).mockResolvedValueOnce({
      items: [
        {
          id: "provider-1",
          name: "硅基流动",
          apiKeySet: true,
          isActive: true,
          models: [
            {
              id: "model-1",
              modelName: "deepseek-ai/DeepSeek-V3.2",
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
    });

    renderChat(api);

    const selectedButton = await screen.findByRole("button", { name: /DeepSeek-V3\.2/ });
    expect(selectedButton).toHaveTextContent("DeepSeek-V3.2");
    expect(selectedButton).not.toHaveTextContent("deepseek-ai/");

    await user.click(selectedButton);

    expect(screen.getByRole("button", { name: /deepseek-ai\/DeepSeek-V3\.2/ })).toBeInTheDocument();
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

  it("loads streamed tool details with the original persisted content id", async () => {
    const api = baseApi();
    api.client.fetchSessionMessages.mockImplementation(async () => ({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    }));
    api.client.fetchMessageContentToolDetails = vi.fn(async () => ({
      toolCalls: [{ name: "time.now", arguments: { format: "full" } }],
      toolCallsResponse: [{ name: "time.now", content: "当前时间", toolCallId: "tool-1" }],
    }));
    api.chatStream.chat = vi.fn(async function* () {
      yield {
        type: "create" as const,
        messageId: "assistant-real",
        turnsId: "turn-1",
        contentId: "content-real",
        modelName: "DeepSeek-V3.2",
      };
      yield { type: "text" as const, content: "先看时间。" };
      yield {
        type: "tool_call" as const,
        toolCalls: [
          {
            id: "tool-1",
            name: "time.now",
            metadata: { displayMessage: { action: "已获取当前时间", args: "full" } },
          },
        ],
      };
      yield {
        type: "tool_calls_response" as const,
        toolCallsResponse: [{ name: "time.now", content: "当前时间", toolCallId: "tool-1" }],
      };
      yield { type: "text" as const, content: "现在是 15:50。" };
      yield { type: "finish" as const, finishReason: "stop" };
    });
    const user = userEvent.setup();
    renderChat(api);

    await user.type(await screen.findByPlaceholderText("按 / 使用技能，Shift+Enter 换行"), "现在几点？");
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("button", { name: /工具调用/ }));

    expect(api.client.fetchMessageContentToolDetails).toHaveBeenCalledWith("content-real");
    expect(api.client.fetchMessageContentToolDetails).not.toHaveBeenCalledWith(expect.stringContaining("-tool"));
  });
});
