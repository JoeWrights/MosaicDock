import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NewSessionPage, type NewSessionPageApi } from ".";

const typewriterDelayMs = 100;

function createApi(): NewSessionPageApi {
  return {
    client: {
      fetchSessionGroups: vi.fn(async () => [
        { id: "group-1", name: "研发任务" },
        { id: "group-2", name: "客户项目" },
      ]),
      fetchKnowledgeBases: vi.fn(async () => ({
        items: [
          { id: "kb-product", name: "产品知识库", description: "产品说明和规划" },
          { id: "kb-design", name: "设计知识库", description: "设计规范" },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      })),
      fetchSkills: vi.fn(async () => ({
        items: [
          {
            id: "skill-creator",
            name: "skill-creator",
            manifest: { name: "skill-creator", description: "Creating and authoring new AI skills" },
          },
          {
            id: "frontend-design",
            name: "frontend-design",
            manifest: { name: "frontend-design", description: "Guidance for distinctive UI design" },
          },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      })),
      fetchAppearanceSettings: vi.fn(async () => ({})),
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
                config: {
                  inputCapabilities: ["text"],
                  outputCapabilities: ["text"],
                  features: ["tools", "thinking"],
                },
              },
              {
                id: "model-2",
                modelName: "DeepSeek-R1",
                modelType: "text",
                providerId: "provider-1",
                isActive: true,
                config: {
                  inputCapabilities: ["text"],
                  outputCapabilities: ["text"],
                  features: ["tools"],
                },
              },
              {
                id: "model-3",
                modelName: "Qwen/Qwen3.5-397B-A17B",
                modelType: "text",
                providerId: "provider-1",
                isActive: true,
                config: {
                  inputCapabilities: ["text", "image"],
                  outputCapabilities: ["text"],
                  features: ["tools", "thinking"],
                },
              },
            ],
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      })),
      fetchCharacters: vi.fn(async () => ({
        items: [
          {
            id: "character-1",
            title: "智能助手",
            description: "一个友好、专业的 AI 助手，可以帮助你解答各种问题。",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      })),
      fetchTeams: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 20 })),
      fetchSessions: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 10 })),
      uploadSessionFile: vi.fn(async (_sessionId, file) => ({
        id: "file-uploaded",
        displayName: file.name,
        fileName: file.name,
        fileType: file.type.startsWith("image/") ? "image" : "text",
        fileSize: file.size,
        url: "/uploads/images/uploaded.jpg",
        previewUrl: "/uploads/previews/uploaded.jpg",
      })),
      createSession: vi.fn(async () => ({
        id: "session-new",
        title: "现在几点了？",
        characterId: "character-1",
        modelId: "model-1",
        userId: "user-1",
        settings: {},
        createdAt: "2026-06-28T00:00:00.000Z",
        updatedAt: "2026-06-28T00:00:00.000Z",
      })),
      createSessionGroup: vi.fn(async () => ({ id: "group-3", name: "设计任务", sortOrder: 2 })),
      updateSessionGroup: vi.fn(async () => ({ id: "group-1", name: "研发项目", sortOrder: 0 })),
      deleteSessionGroup: vi.fn(async () => ({ success: true })),
      reorderSessionGroups: vi.fn(async () => ({ success: true })),
    },
    sessionEvents: {
      connect: vi.fn(),
      disconnect: vi.fn(),
    },
  };
}

function renderNewSession(api: NewSessionPageApi = createApi()) {
  return render(
    <MemoryRouter initialEntries={["/chat/new-session"]}>
      <Routes>
        <Route path="/chat/new-session" element={<NewSessionPage api={api} />} />
        <Route path="/chat/:sessionId" element={<LocationStateProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function LocationStateProbe() {
  const location = useLocation();
  const state = location.state as {
    pendingUserMessage?: {
      contents?: { content: string | null }[];
      files?: { id?: string; displayName?: string }[];
    };
    pendingKnowledgeBaseIds?: string[];
  } | null;

  return (
    <div>
      <span data-testid="location-path">{location.pathname}</span>
      <span data-testid="pending-message-content">
        {state?.pendingUserMessage?.contents?.[0]?.content ?? ""}
      </span>
      <span data-testid="pending-message-file-name">
        {state?.pendingUserMessage?.files?.[0]?.displayName ?? ""}
      </span>
      <span data-testid="pending-knowledge-base-ids">
        {state?.pendingKnowledgeBaseIds?.join(",") ?? ""}
      </span>
    </div>
  );
}

describe("NewSessionPage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the new-session landing view", async () => {
    const api = createApi();
    const { container } = renderNewSession(api);

    expect(screen.getByText("新建对话")).toBeInTheDocument();
    expect(screen.getByTestId("new-session-greeting")).toBeInTheDocument();
    expect(screen.getByText("智能助手")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "消息输入框" })).toBeInTheDocument();
    expect(container.querySelector('[class*="ant-"]')).toBeNull();
  });

  it("uses guada-aligned compact input panel styling", () => {
    const api = createApi();
    renderNewSession(api);

    const panel = screen.getByTestId("new-session-input-panel");
    const card = screen.getByTestId("new-session-input-card");

    expect(panel.className).toContain("max-w-[800px]");
    expect(card.className).toContain("rounded-[22px]");
    expect(card.className).toContain("shadow-[0_2px_22px_rgba(0,0,0,0.11)]");
    expect(card.className).not.toContain("border ");
  });

  it("keeps the input panel compact and only strengthens shadow on focus", () => {
    const api = createApi();
    renderNewSession(api);

    const card = screen.getByTestId("new-session-input-card");
    const input = screen.getByRole("textbox", { name: "消息输入框" });

    expect(card.className).toContain("shadow-[0_2px_12px_rgba(0,0,0,0.08)]");
    expect(card.className).toContain("focus-within:shadow-[0_2px_22px_rgba(0,0,0,0.11)]");
    expect(input.className).toContain("min-h-20");
    expect(input.className).not.toContain("min-h-28");
  });

  it("reveals the greeting with a typewriter effect", () => {
    vi.useFakeTimers();
    const api = createApi();
    renderNewSession(api);

    const greeting = screen.getByTestId("new-session-greeting");
    expect(greeting).toHaveTextContent("");

    act(() => {
      vi.advanceTimersByTime(45);
    });
    expect(greeting).toBeEmptyDOMElement();

    act(() => {
      vi.advanceTimersByTime(typewriterDelayMs - 45);
    });
    expect(greeting).toHaveTextContent("H");

    act(() => {
      vi.advanceTimersByTime(typewriterDelayMs * "Hi，想聊些什么？".length);
    });
    expect(greeting).toHaveTextContent("Hi，想聊些什么？");
  });

  it("loops the greeting typewriter animation", () => {
    vi.useFakeTimers();
    const api = createApi();
    renderNewSession(api);

    const greeting = screen.getByTestId("new-session-greeting");

    act(() => {
      vi.advanceTimersByTime(typewriterDelayMs * "Hi，想聊些什么？".length);
    });
    expect(greeting).toHaveTextContent("Hi，想聊些什么？");

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(greeting).toBeEmptyDOMElement();

    act(() => {
      vi.advanceTimersByTime(typewriterDelayMs);
    });
    expect(greeting).toHaveTextContent("H");
  });

  it("loads the same initial resources as the legacy new-session page", async () => {
    const api = createApi();
    renderNewSession(api);

    await waitFor(() => {
      expect(api.sessionEvents.connect).toHaveBeenCalled();
      expect(api.client.fetchSessionGroups).toHaveBeenCalled();
      expect(api.client.fetchKnowledgeBases).toHaveBeenCalled();
      expect(api.client.fetchSkills).toHaveBeenCalled();
      expect(api.client.fetchAppearanceSettings).toHaveBeenCalled();
      expect(api.client.fetchModels).toHaveBeenCalled();
      expect(api.client.fetchCharacters).toHaveBeenCalled();
      expect(api.client.fetchTeams).toHaveBeenCalled();
      expect(api.client.fetchSessions).toHaveBeenCalledWith({
        skip: 0,
        limit: 10,
        groupId: null,
      });
    });
  });

  it("opens the guada-style model selector and switches models", async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderNewSession(api);

    expect(await screen.findByRole("button", { name: /DeepSeek-V3\.2/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /DeepSeek-V3\.2/ }));

    expect(screen.getByPlaceholderText("搜索模型...")).toBeInTheDocument();
    expect(screen.getByText("硅基流动")).toBeInTheDocument();
    expect(screen.getByLabelText("能力：文本输入到文本输出、工具、思考")).toBeInTheDocument();
    expect(screen.getByLabelText("能力：文本输入到文本输出、工具")).toBeInTheDocument();
    expect(screen.getByLabelText("能力：文本和图片输入到文本输出、工具、思考")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /DeepSeek-R1/ }));

    expect(screen.getByRole("button", { name: /DeepSeek-R1/ })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("搜索模型...")).not.toBeInTheDocument();
  });

  it("uploads attachments after creating the new session and passes them to the pending message", async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderNewSession(api);

    const image = new File(["image-bytes"], "截图.png", { type: "image/png" });
    await user.upload(await screen.findByLabelText("上传图片文件"), image);

    expect(api.client.uploadSessionFile).not.toHaveBeenCalled();
    expect(await screen.findByRole("img", { name: "截图.png" })).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "消息输入框" }), "analyze image");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(api.client.createSession).toHaveBeenCalledWith(expect.objectContaining({ title: "analyze image" }));
      expect(api.client.uploadSessionFile).toHaveBeenCalledWith("session-new", image);
    });
    expect(screen.getByTestId("location-path")).toHaveTextContent("/chat/session-new");
    expect(screen.getByTestId("pending-message-content")).toHaveTextContent("analyze image");
    expect(screen.getByTestId("pending-message-file-name")).toHaveTextContent("截图.png");
  });

  it("uses guada-aligned upload accept filters", async () => {
    const api = createApi();
    renderNewSession(api);

    expect(await screen.findByLabelText("上传图片文件")).toHaveAttribute(
      "accept",
      expect.stringContaining(".jpg,.jpeg,.png"),
    );
    expect(screen.getByLabelText("上传附件文件")).toHaveAttribute(
      "accept",
      expect.stringContaining(".docx,.xlsx,.dts,.dtsi"),
    );
    expect(screen.getByLabelText("上传附件文件")).not.toHaveAttribute("accept", expect.stringContaining("image"));
  });

  it("selects knowledge bases from the guada-style composer panel and passes them to chat", async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderNewSession(api);

    await user.click(await screen.findByRole("button", { name: "知识库" }));

    expect(screen.getByPlaceholderText("搜索知识库...")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /产品知识库/ }));

    expect(screen.getByRole("button", { name: "移除知识库 产品知识库" })).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "消息输入框" }), "with knowledge base");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(api.client.createSession).toHaveBeenCalledWith(expect.objectContaining({ title: "with knowledge base" }));
    });
    expect(screen.getByTestId("pending-knowledge-base-ids")).toHaveTextContent("kb-product");
  });

  it("selects skills with slash command and passes guada skill tags to chat", async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderNewSession(api);

    const composer = screen.getByRole("textbox", { name: "消息输入框" });
    await user.type(composer, "/");

    expect(screen.getByRole("listbox", { name: "技能选择" })).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /skill-creator/ }));

    const skillBadge = within(composer).getByText("/skill-creator");
    expect(skillBadge).toHaveAttribute("contenteditable", "false");

    await user.type(composer, "create skill");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(api.client.createSession).toHaveBeenCalledWith(expect.objectContaining({ title: "<skill:skill-creator> create skill" }));
    });
    expect(screen.getByTestId("pending-message-content")).toHaveTextContent("<skill:skill-creator> create skill");
  });

  it("shortens prefixed model names only in the selected model button", async () => {
    const api = createApi();
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

    renderNewSession(api);

    const selectedButton = await screen.findByRole("button", { name: /DeepSeek-V3\.2/ });
    expect(selectedButton).toHaveTextContent("DeepSeek-V3.2");
    expect(selectedButton).not.toHaveTextContent("deepseek-ai/");

    await user.click(selectedButton);

    expect(screen.getByRole("button", { name: /deepseek-ai\/DeepSeek-V3\.2/ })).toBeInTheDocument();
  });

  it("closes the model selector when clicking outside", async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderNewSession(api);

    await user.click(await screen.findByRole("button", { name: /DeepSeek-V3\.2/ }));
    expect(screen.getByPlaceholderText("搜索模型...")).toBeInTheDocument();

    await user.click(screen.getByText("新建对话"));

    expect(screen.queryByPlaceholderText("搜索模型...")).not.toBeInTheDocument();
  });

  it("opens the guada-style thinking effort panel and switches effort", async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderNewSession(api);

    await user.click(screen.getByRole("button", { name: "不思考" }));

    expect(screen.getByText("思考强度")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /低强度\s*low/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /中等强度\s*medium/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /高强度\s*high/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /极致\s*xhigh/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /中等强度\s*medium/ }));

    expect(screen.getByRole("button", { name: "中等强度" })).toBeInTheDocument();
    expect(screen.queryByText("思考强度")).not.toBeInTheDocument();
  });

  it("shows tooltips for composer tool icons on hover", async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderNewSession(api);

    await user.hover(screen.getByRole("button", { name: "添加图片" }));
    expect(screen.getByRole("tooltip", { name: "添加图片" })).toBeInTheDocument();

    await user.hover(screen.getByRole("button", { name: "上传文件" }));
    expect(screen.getByRole("tooltip", { name: "上传文件" })).toBeInTheDocument();

    await user.hover(screen.getByRole("button", { name: "知识库" }));
    expect(screen.getByRole("tooltip", { name: "知识库" })).toBeInTheDocument();
  });

  it("creates a session, creates the first message, and navigates to chat on send", async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderNewSession(api);

    await user.type(screen.getByRole("textbox", { name: "消息输入框" }), "what time");
    await user.click(screen.getByRole("button", { name: "发送消息" }));

    await waitFor(() => {
      expect(api.client.createSession).toHaveBeenCalledWith({
        characterId: "character-1",
        modelId: "model-1",
        title: "what time",
        settings: { thinkingEffort: "off" },
      });
    });
    expect(await screen.findByTestId("location-path")).toHaveTextContent("/chat/session-new");
    expect(screen.getByTestId("pending-message-content")).toHaveTextContent("what time");
  });

  it("opens workspace settings, validates absolute paths, and updates the display", async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderNewSession(api);

    await user.click(screen.getByRole("button", { name: /工作目录：自动创建/ }));

    expect(screen.getByRole("heading", { name: "工作目录设置" })).toBeInTheDocument();
    expect(screen.getByText("设置当前会话的工作目录路径。留空则使用系统默认目录。")).toBeInTheDocument();

    const input = screen.getByLabelText("工作目录路径");
    await user.type(input, "relative/path");
    await user.click(screen.getByRole("button", { name: "确定" }));

    expect(screen.getByText("工作目录必须是绝对路径")).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "/Users/joewright/workspace/demo-project");
    await user.click(screen.getByRole("button", { name: "确定" }));

    expect(screen.queryByRole("heading", { name: "工作目录设置" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /工作目录：demo-project/ })).toBeInTheDocument();
  });

  it("opens the group selector and updates the selected group", async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderNewSession(api);

    await user.click(screen.getByRole("button", { name: /分组：任务列表/ }));

    expect(screen.getByRole("heading", { name: "请选择分组" })).toBeInTheDocument();
    const dialog = screen.getByRole("dialog", { name: "请选择分组" });
    await user.click(within(dialog).getByRole("button", { name: "关闭分组选择" }));
    expect(screen.queryByRole("dialog", { name: "请选择分组" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /分组：任务列表/ }));
    const reopenedDialog = screen.getByRole("dialog", { name: "请选择分组" });
    expect(within(reopenedDialog).getByRole("button", { name: /任务列表/ })).toBeInTheDocument();
    expect(await within(reopenedDialog).findByRole("button", { name: /研发任务/ })).toBeInTheDocument();
    expect(within(reopenedDialog).getByRole("button", { name: /客户项目/ })).toBeInTheDocument();

    await user.click(within(reopenedDialog).getByRole("button", { name: /客户项目/ }));

    expect(screen.queryByRole("heading", { name: "请选择分组" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /分组：客户项目/ })).toBeInTheDocument();
  });

  it("opens group management from the group selector", async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderNewSession(api);

    await user.click(screen.getByRole("button", { name: /分组：任务列表/ }));
    const selector = screen.getByRole("dialog", { name: "请选择分组" });

    await user.click(within(selector).getByRole("button", { name: "管理分组" }));

    expect(screen.queryByRole("dialog", { name: "请选择分组" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "分组管理" })).toBeInTheDocument();
    expect(await screen.findByText("研发任务")).toBeInTheDocument();
  });
});
