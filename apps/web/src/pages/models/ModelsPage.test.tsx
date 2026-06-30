import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ModelsPage, type ModelsPageApi } from ".";

function createApi(): ModelsPageApi {
  return {
    client: {
      fetchAllModels: vi.fn(async () => ({
        items: [
          {
            id: "provider-added",
            name: "硅基流动",
            provider: "siliconflow",
            protocol: "openai",
            apiUrl: "https://api.siliconflow.cn/v1",
            attributes: { headers: { "X-Provider": "siliconflow" } },
            apiKeySet: true,
            isActive: true,
            models: [
              {
                id: "model-1",
                modelName: "DeepSeek-V3.2",
                modelType: "text",
                providerId: "provider-added",
                isActive: true,
                isFavorite: false,
              },
              {
                id: "model-2",
                modelName: "DeepSeek-R1",
                modelType: "text",
                providerId: "provider-added",
                isActive: false,
                isFavorite: true,
              },
            ],
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      })),
      createProvider: vi.fn(async (data) => ({
        id: "provider-custom",
        name: data.name,
        provider: data.provider,
        protocol: data.protocol,
        apiUrl: data.apiUrl,
        apiKeySet: true,
        isActive: true,
        attributes: data.attributes,
        models: [],
      })),
      testProviderConnection: vi.fn(async () => ({
        success: true,
        message: "连接成功",
      })),
      updateProvider: vi.fn(async (_providerId, data) => ({
        id: "provider-added",
        name: data.name ?? "硅基流动",
        provider: "siliconflow",
        protocol: data.protocol ?? "openai",
        apiUrl: data.apiUrl ?? "https://api.siliconflow.cn/v1",
        apiKeySet: true,
        isActive: true,
        attributes: data.attributes,
        models: [],
      })),
      deleteProvider: vi.fn(async () => ({ success: true })),
      fetchRemoteModels: vi.fn(async () => ({
        items: [
          {
            modelName: "Qwen3-Coder",
            modelType: "text",
            config: { contextWindow: 128000 },
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        size: 1,
      })),
      createModel: vi.fn(async (data) => ({
        id: `created-${data.modelName}`,
        modelName: data.modelName,
        modelType: data.modelType,
        providerId: data.providerId,
        isActive: true,
      })),
      updateModel: vi.fn(async (modelId, data) => ({
        id: modelId,
        modelName: data.modelName ?? "Updated",
        modelType: data.modelType ?? "text",
        providerId: "provider-added",
        isActive: true,
      })),
      deleteModel: vi.fn(async () => ({ success: true })),
      toggleModelActive: vi.fn(async (modelId) => ({
        id: modelId,
        modelName: "DeepSeek-V3.2",
        modelType: "text",
        providerId: "provider-added",
        isActive: false,
      })),
      toggleModelFavorite: vi.fn(async (modelId) => ({
        id: modelId,
        modelName: "DeepSeek-V3.2",
        modelType: "text",
        providerId: "provider-added",
        isActive: true,
        isFavorite: true,
      })),
    },
  } as ModelsPageApi;
}

describe("ModelsPage", () => {
  const maskedApiKey = "••••••••••••••••••••••••••••••••";

  it("renders guada-style provider sections from all model providers", async () => {
    const api = createApi();

    render(<ModelsPage api={api} />);

    expect(screen.getByRole("heading", { name: "模型管理" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "供应商列表" })).toBeInTheDocument();
    expect(await screen.findByText("已添加的供应商")).toBeInTheDocument();
    expect(screen.getByText("可添加的供应商")).toBeInTheDocument();

    const addedSection = screen.getByLabelText("已添加的供应商");
    expect(within(addedSection).getByRole("article", { name: /硅基流动/ })).toBeInTheDocument();
    expect(within(addedSection).getByText("提供高性价比的开源模型 API 服务，支持多种主流大语言模型。")).toBeInTheDocument();

    const availableSection = screen.getByLabelText("可添加的供应商");
    expect(within(availableSection).getByRole("article", { name: /Custom/ })).toBeInTheDocument();
    expect(within(availableSection).getByRole("article", { name: /火山引擎/ })).toBeInTheDocument();
    expect(within(availableSection).getByRole("article", { name: /DeepSeek/ })).toBeInTheDocument();
    expect(within(availableSection).getByRole("article", { name: /阿里云百炼/ })).toBeInTheDocument();
    expect(within(availableSection).getByText("OpenAI (Responses API)")).toBeInTheDocument();
    const moonshotCard = within(availableSection).getByRole("article", { name: /Moonshot AI/ });
    expect(within(moonshotCard).getByRole("presentation", { hidden: true })).toHaveAttribute(
      "src",
      "/images/providers/moonshot.svg",
    );
    expect(within(availableSection).getByRole("article", { name: /Google/ })).toBeInTheDocument();
    expect(within(availableSection).getByText("Gemini")).toBeInTheDocument();
    const anthropicCard = within(availableSection).getByRole("article", { name: /Anthropic/ });
    expect(anthropicCard).toBeInTheDocument();
    expect(within(anthropicCard).getAllByText("Anthropic").length).toBeGreaterThanOrEqual(1);
    expect(within(availableSection).getAllByText("添加此供应商").length).toBeGreaterThan(1);

    await waitFor(() => expect(api.client.fetchAllModels).toHaveBeenCalledTimes(1));
  });

  it("creates a custom provider with Guada-style dialog and connection test", async () => {
    const api = createApi();
    const user = userEvent.setup();

    render(<ModelsPage api={api} />);

    await user.click(screen.getByRole("button", { name: "添加自定义" }));
    const dialog = screen.getByRole("dialog", { name: "新建分组" });

    await user.type(within(dialog).getByLabelText("名字"), "我的网关");
    await user.click(within(dialog).getByRole("button", { name: "协议类型" }));
    const protocolList = within(dialog).getByRole("listbox", { name: "协议类型" });
    await user.click(within(protocolList).getByRole("option", { name: "OpenAI-Response" }));
    await user.type(within(dialog).getByLabelText("API地址"), "https://gateway.example.com/v1");
    await user.type(within(dialog).getByLabelText("API KEY"), "sk-test");
    await user.type(within(dialog).getByLabelText("自定义请求头"), "Authorization: Bearer token\nX-Trace: abc");

    await user.click(within(dialog).getByRole("button", { name: "测试" }));
    expect(await within(dialog).findByText("连接成功")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "确定" }));

    await waitFor(() =>
      expect(api.client.createProvider).toHaveBeenCalledWith({
        name: "我的网关",
        provider: "custom",
        protocol: "openai-response",
        apiUrl: "https://gateway.example.com/v1",
        apiKey: "sk-test",
        attributes: {
          headers: {
            Authorization: "Bearer token",
            "X-Trace": "abc",
          },
        },
      }),
    );
    expect(api.client.fetchAllModels).toHaveBeenCalledTimes(2);
  });

  it("adds a template provider from the available provider card", async () => {
    const api = createApi();
    const user = userEvent.setup();

    render(<ModelsPage api={api} />);

    const availableSection = await screen.findByLabelText("可添加的供应商");
    const deepSeekCard = within(availableSection).getByRole("article", { name: /DeepSeek/ });

    await user.click(within(deepSeekCard).getByRole("button", { name: "添加此供应商" }));

    await waitFor(() =>
      expect(api.client.createProvider).toHaveBeenCalledWith({
        name: "DeepSeek",
        provider: "deepseek",
        protocol: "openai",
        apiUrl: "",
        apiKey: "",
      }),
    );
    expect(api.client.fetchAllModels).toHaveBeenCalledTimes(2);
  });

  it("deletes an added provider from the provider card with confirmation", async () => {
    const api = createApi();
    const user = userEvent.setup();

    render(<ModelsPage api={api} />);

    const addedSection = await screen.findByLabelText("已添加的供应商");
    const addedCard = within(addedSection).getByRole("article", { name: /硅基流动/ });

    await user.click(within(addedCard).getByRole("button", { name: "删除供应商 硅基流动" }));

    const deleteDialog = screen.getByRole("dialog", { name: "删除供应商" });
    expect(within(deleteDialog).getByText(/确定要删除供应商“硅基流动”吗/)).toBeInTheDocument();

    await user.click(within(deleteDialog).getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("dialog", { name: "删除供应商" })).not.toBeInTheDocument();
    expect(api.client.deleteProvider).not.toHaveBeenCalled();

    await user.click(within(addedCard).getByRole("button", { name: "删除供应商 硅基流动" }));
    await user.click(within(screen.getByRole("dialog", { name: "删除供应商" })).getByRole("button", { name: "确认" }));

    await waitFor(() => expect(api.client.deleteProvider).toHaveBeenCalledWith("provider-added"));
    expect(api.client.fetchAllModels).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toHaveTextContent("删除成功");
  });

  it("opens the custom provider dialog from the custom provider card", async () => {
    const api = createApi();
    const user = userEvent.setup();

    render(<ModelsPage api={api} />);

    const availableSection = await screen.findByLabelText("可添加的供应商");
    const customCard = within(availableSection).getByRole("article", { name: /Custom/ });

    await user.click(within(customCard).getByRole("button", { name: "添加此供应商" }));

    expect(screen.getByRole("dialog", { name: "新建分组" })).toBeInTheDocument();
    expect(api.client.createProvider).not.toHaveBeenCalled();
  });

  it("manages provider models with manual add, remote sync, favorite, active toggle, and delete", async () => {
    const api = createApi();
    const user = userEvent.setup();

    render(<ModelsPage api={api} />);

    const addedSection = await screen.findByLabelText("已添加的供应商");
    const addedCard = within(addedSection).getByRole("article", { name: /硅基流动/ });
    await user.click(within(addedCard).getByRole("button", { name: "模型管理" }));

    const dialog = screen.getByRole("dialog", { name: "硅基流动 模型管理" });
    expect(within(dialog).getByText("DeepSeek-V3.2")).toBeInTheDocument();
    expect(within(dialog).getByText("DeepSeek-R1")).toBeInTheDocument();

    const activeModelRow = within(dialog).getByRole("row", { name: /DeepSeek-V3.2/ });
    await user.click(within(activeModelRow).getByRole("button", { name: "收藏" }));
    expect(api.client.toggleModelFavorite).toHaveBeenCalledWith("model-1");

    await user.click(within(activeModelRow).getByRole("button", { name: "禁用" }));
    expect(api.client.toggleModelActive).toHaveBeenCalledWith("model-1");

    await user.click(within(activeModelRow).getByRole("button", { name: "删除" }));
    expect(api.client.deleteModel).toHaveBeenCalledWith("model-1");

    await user.click(within(dialog).getByRole("button", { name: "手动添加模型" }));
    const addModelDialog = screen.getByRole("dialog", { name: "新增模型" });
    expect(within(addModelDialog).getByText("输入能力")).toBeInTheDocument();
    expect(within(addModelDialog).getByText("输出能力")).toBeInTheDocument();
    expect(within(addModelDialog).getByText("高级功能")).toBeInTheDocument();

    await user.type(within(addModelDialog).getByLabelText(/模型名称/), "custom-chat");
    await user.click(within(addModelDialog).getByRole("button", { name: "对话 (Chat)" }));
    await user.click(within(addModelDialog).getByRole("checkbox", { name: "图像输入" }));
    await user.click(within(addModelDialog).getByRole("checkbox", { name: "图像输出" }));
    await user.click(within(addModelDialog).getByRole("checkbox", { name: "工具调用" }));
    await user.clear(within(addModelDialog).getByLabelText("上下文窗口"));
    await user.type(within(addModelDialog).getByLabelText("上下文窗口"), "64000");
    await user.clear(within(addModelDialog).getByLabelText("最大输出长度"));
    await user.type(within(addModelDialog).getByLabelText("最大输出长度"), "8192");
    await user.clear(within(addModelDialog).getByLabelText("自定义参数(JSON)"));
    fireEvent.change(within(addModelDialog).getByLabelText("自定义参数(JSON)"), {
      target: { value: '{"vendor":"custom"}' },
    });
    await user.click(within(addModelDialog).getByRole("button", { name: "保存更改" }));
    expect(api.client.createModel).toHaveBeenCalledWith({
      providerId: "provider-added",
      modelName: "custom-chat",
      modelType: "text",
      config: {
        inputCapabilities: ["text", "image"],
        outputCapabilities: ["text", "image"],
        features: ["tool"],
        contextWindow: 64000,
        maxOutputTokens: 8192,
        vendor: "custom",
      },
    });

    await user.click(within(dialog).getByRole("button", { name: "同步远程模型" }));
    expect(api.client.fetchRemoteModels).toHaveBeenCalledWith("provider-added");
    const remoteModelRow = await within(dialog).findByRole("row", { name: /Qwen3-Coder/ });
    await user.click(within(remoteModelRow).getByRole("button", { name: "导入" }));
    expect(api.client.createModel).toHaveBeenCalledWith({
      providerId: "provider-added",
      modelName: "Qwen3-Coder",
      modelType: "text",
      config: { contextWindow: 128000 },
    });

    expect(api.client.fetchAllModels).toHaveBeenCalled();
  });

  it("locks page scrolling while a model management dialog is open", async () => {
    const api = createApi();
    const user = userEvent.setup();

    render(<ModelsPage api={api} />);

    const addedSection = await screen.findByLabelText("已添加的供应商");
    const addedCard = within(addedSection).getByRole("article", { name: /硅基流动/ });
    await user.click(within(addedCard).getByRole("button", { name: "模型管理" }));

    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");

    const dialog = screen.getByRole("dialog", { name: "硅基流动 模型管理" });
    await user.click(within(dialog).getByRole("button", { name: "关闭" }));

    expect(document.body.style.overflow).toBe("");
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("updates, tests, and deletes provider settings from the provider settings dialog", async () => {
    const api = createApi();
    const user = userEvent.setup();

    render(<ModelsPage api={api} />);

    const addedSection = await screen.findByLabelText("已添加的供应商");
    const addedCard = within(addedSection).getByRole("article", { name: /硅基流动/ });
    await user.click(within(addedCard).getByRole("button", { name: "供应商设置" }));

    const dialog = screen.getByRole("dialog", { name: "硅基流动 供应商设置" });
    expect(within(dialog).getByLabelText("名字")).toHaveValue("硅基流动");
    expect(within(dialog).getByLabelText("API地址")).toHaveValue("https://api.siliconflow.cn/v1");

    const apiKeyInput = within(dialog).getByLabelText("API KEY");
    expect(apiKeyInput).toHaveValue(maskedApiKey);
    await user.clear(apiKeyInput);
    await user.type(apiKeyInput, "sk-updated");
    await user.clear(within(dialog).getByLabelText("自定义请求头"));
    await user.type(within(dialog).getByLabelText("自定义请求头"), "Authorization: Bearer updated");

    await user.click(within(dialog).getByRole("button", { name: "测试" }));
    expect(api.client.testProviderConnection).toHaveBeenCalledWith({
      provider: "siliconflow",
      protocol: "openai",
      apiUrl: "https://api.siliconflow.cn/v1",
      apiKey: "sk-updated",
      attributes: {
        headers: {
          Authorization: "Bearer updated",
        },
      },
    });
    expect(await within(dialog).findByText("连接成功")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(api.client.updateProvider).toHaveBeenCalledWith("provider-added", {
        name: "硅基流动",
        protocol: "openai",
        apiUrl: "https://api.siliconflow.cn/v1",
        apiKey: "sk-updated",
        attributes: {
          headers: {
            Authorization: "Bearer updated",
          },
        },
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "硅基流动 供应商设置" })).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("保存成功");

    const refreshedAddedSection = screen.getByLabelText("已添加的供应商");
    const refreshedAddedCard = within(refreshedAddedSection).getByRole("article", { name: /硅基流动/ });
    await user.click(within(refreshedAddedCard).getByRole("button", { name: "供应商设置" }));
    const reopenedDialog = screen.getByRole("dialog", { name: "硅基流动 供应商设置" });
    await user.click(within(reopenedDialog).getByRole("button", { name: "删除供应商" }));
    expect(api.client.deleteProvider).toHaveBeenCalledWith("provider-added");
  });

  it("shows a masked existing API key and preserves it when saving unchanged", async () => {
    const api = createApi();
    const user = userEvent.setup();

    render(<ModelsPage api={api} />);

    const addedSection = await screen.findByLabelText("已添加的供应商");
    const addedCard = within(addedSection).getByRole("article", { name: /硅基流动/ });
    await user.click(within(addedCard).getByRole("button", { name: "供应商设置" }));

    const dialog = screen.getByRole("dialog", { name: "硅基流动 供应商设置" });
    expect(within(dialog).getByLabelText("API KEY")).toHaveValue(maskedApiKey);

    await user.click(within(dialog).getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(api.client.updateProvider).toHaveBeenCalledWith("provider-added", {
        name: "硅基流动",
        protocol: "openai",
        apiUrl: "https://api.siliconflow.cn/v1",
        attributes: {
          headers: {
            "X-Provider": "siliconflow",
          },
        },
      }),
    );
    expect(api.client.updateProvider).not.toHaveBeenCalledWith(
      "provider-added",
      expect.objectContaining({ apiKey: maskedApiKey }),
    );
  });

  it("toggles visibility when refreshed provider data contains apiKey", async () => {
    const api = createApi();
    api.client.fetchAllModels = vi.fn(async () => ({
      items: [
        {
          id: "provider-added",
          name: "硅基流动",
          provider: "siliconflow",
          protocol: "openai",
          apiUrl: "https://api.siliconflow.cn/v1",
          apiKey: "sk-saved-secret",
          apiKeySet: false,
          isActive: true,
          models: [],
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    }));
    const user = userEvent.setup();

    render(<ModelsPage api={api} />);

    const addedSection = await screen.findByLabelText("已添加的供应商");
    const addedCard = within(addedSection).getByRole("article", { name: /硅基流动/ });
    await user.click(within(addedCard).getByRole("button", { name: "供应商设置" }));

    const dialog = screen.getByRole("dialog", { name: "硅基流动 供应商设置" });
    const apiKeyInput = within(dialog).getByLabelText("API KEY");
    expect(apiKeyInput).toHaveValue("sk-saved-secret");
    expect(apiKeyInput).toHaveAttribute("type", "password");
    expect(within(dialog).getByRole("button", { name: "显示 API KEY" }).querySelector(".lucide-eye-off")).not.toBeNull();

    await user.click(within(dialog).getByRole("button", { name: "显示 API KEY" }));

    expect(apiKeyInput).toHaveAttribute("type", "text");
    expect(within(dialog).getByRole("button", { name: "隐藏 API KEY" }).querySelector(".lucide-eye")).not.toBeNull();
  });
});
