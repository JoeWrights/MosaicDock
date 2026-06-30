import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BotsManagementPage, type BotsManagementPageApi } from "./index";

function createApi(overrides: Partial<BotsManagementPageApi["client"]> = {}): BotsManagementPageApi {
  return {
    client: {
      fetchBotPlatforms: vi.fn(async () => [
        {
          platform: "qq",
          displayName: "QQ 机器人",
          description: "接入 QQ 开放平台机器人",
          fields: [
            {
              key: "appId",
              label: "App ID",
              type: "text" as const,
              required: true,
              placeholder: "请输入 QQ 开放平台 App ID",
              description: "在 QQ 开放平台创建应用后获取",
            },
            {
              key: "sandbox",
              label: "沙箱环境",
              type: "boolean" as const,
              required: false,
              defaultValue: false,
              description: "开发测试时启用",
            },
          ],
        },
      ]),
      fetchBotInstances: vi.fn(async () => [
        {
          id: "bot-1",
          userId: "user-1",
          platform: "mock",
          name: "测试机器人",
          enabled: true,
          platformConfig: {},
          reconnectEnabled: true,
          maxRetries: 5,
          retryInterval: 5000,
          defaultCharacterId: "character-1",
          defaultModelId: null,
          status: "stopped",
          runtimeStatus: "stopped",
          lastStartedAt: null,
          lastError: null,
          additionalKwargs: null,
          createdAt: "2026-06-29T00:00:00.000Z",
          updatedAt: "2026-06-29T00:00:00.000Z",
        },
      ]),
      fetchCharacters: vi.fn(async () => ({
        items: [
          {
            id: "character-1",
            title: "智能助手",
            userId: "user-1",
            type: "private" as const,
            isActive: true,
            createdAt: "2026-06-29T00:00:00.000Z",
            updatedAt: "2026-06-29T00:00:00.000Z",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      })),
      fetchModels: vi.fn(async () => ({
        items: [
          {
            id: "provider-1",
            name: "DeepSeek",
            apiKeySet: true,
            isActive: true,
            models: [
              {
                id: "model-1",
                modelName: "DeepSeek-V3.2",
                modelType: "chat",
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
      fetchKnowledgeBases: vi.fn(async () => ({
        items: [
          {
            id: "kb-1",
            name: "产品知识库",
            description: "产品资料",
            embeddingModelId: "embedding-1",
            userId: "user-1",
            createdAt: "2026-06-29T00:00:00.000Z",
            updatedAt: "2026-06-29T00:00:00.000Z",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      })),
      createBotInstance: vi.fn(async (data) => ({
        id: "bot-new",
        userId: "user-1",
        platform: data.platform,
        name: data.name,
        enabled: data.autoStart ?? false,
        platformConfig: data.platformConfig,
        reconnectEnabled: data.reconnectConfig?.enabled ?? true,
        maxRetries: data.reconnectConfig?.maxRetries ?? 5,
        retryInterval: data.reconnectConfig?.retryInterval ?? 5000,
        defaultCharacterId: data.defaultCharacterId,
        defaultModelId: data.defaultModelId ?? null,
        status: "stopped",
        runtimeStatus: "DISCONNECTED",
        lastStartedAt: null,
        lastError: null,
        additionalKwargs: data.additionalKwargs,
        createdAt: "2026-06-29T00:00:00.000Z",
        updatedAt: "2026-06-29T00:00:00.000Z",
      })),
      ...overrides,
    },
  };
}

describe("BotsManagementPage", () => {
  it("renders a guada-style bot management page from bot instances", async () => {
    const api = createApi();

    render(<BotsManagementPage api={api} />);

    expect(screen.getByRole("heading", { name: "机器人" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "机器人管理" })).toHaveClass("text-pink-500");
    expect(screen.getByRole("button", { name: "对话数据" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建机器人" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "使用说明" })).toBeInTheDocument();

    const card = await screen.findByTestId("bot-card-bot-1");
    expect(within(card).getByText("测试机器人")).toBeInTheDocument();
    expect(within(card).getByText("mock")).toBeInTheDocument();
    await waitFor(() => expect(api.client.fetchBotInstances).toHaveBeenCalledTimes(1));
  });

  it("shows the guada empty state when there are no bots", async () => {
    render(<BotsManagementPage api={createApi({ fetchBotInstances: vi.fn(async () => []) })} />);

    expect(await screen.findByText("暂无机器人")).toBeInTheDocument();
    expect(screen.getByText("点击上方按钮创建第一个机器人")).toBeInTheDocument();
  });

  it("creates a bot with the Guada-style dialog and dynamic platform fields", async () => {
    const api = createApi({ fetchBotInstances: vi.fn(async () => []) });
    const user = userEvent.setup();
    render(<BotsManagementPage api={api} />);

    await user.click(screen.getByRole("button", { name: "新建机器人" }));

    expect(await screen.findByRole("dialog", { name: "创建机器人" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "选择平台" })).toBeInTheDocument();
    expect(screen.getByText("查看配置教程")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "选择平台" }));
    await user.click(screen.getByRole("option", { name: "QQ 机器人" }));
    expect(screen.getByText("查看QQ 机器人配置教程")).toBeInTheDocument();
    expect(screen.getByText("平台配置")).toBeInTheDocument();

    await user.type(screen.getByLabelText("机器人名称"), "客服机器人");
    await user.click(screen.getByRole("combobox", { name: "默认角色" }));
    await user.click(screen.getByRole("option", { name: "智能助手" }));
    await user.click(screen.getByRole("combobox", { name: "模型选择" }));
    await user.click(screen.getByRole("option", { name: "DeepSeek / DeepSeek-V3.2" }));
    await user.click(screen.getByRole("combobox", { name: "引用知识库" }));
    await user.click(screen.getByRole("option", { name: "产品知识库" }));
    await user.type(screen.getByLabelText("App ID"), "app-123");
    await user.click(screen.getByRole("switch", { name: "沙箱环境" }));
    await user.click(screen.getByRole("switch", { name: "自动启动" }));
    await user.click(screen.getByRole("button", { name: "创建" }));

    await waitFor(() =>
      expect(api.client.createBotInstance).toHaveBeenCalledWith({
        platform: "qq",
        name: "客服机器人",
        defaultCharacterId: "character-1",
        defaultModelId: "model-1",
        platformConfig: { appId: "app-123", sandbox: true },
        reconnectConfig: { enabled: true, maxRetries: 5, retryInterval: 5000 },
        autoStart: true,
        additionalKwargs: { knowledgeBaseIds: ["kb-1"] },
      }),
    );
    expect(screen.queryByRole("dialog", { name: "创建机器人" })).not.toBeInTheDocument();
  });
});
