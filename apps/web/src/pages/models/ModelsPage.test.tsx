import { render, screen, waitFor, within } from "@testing-library/react";
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
            apiKeySet: true,
            isActive: true,
            models: [
              {
                id: "model-1",
                modelName: "DeepSeek-V3.2",
                modelType: "text",
                providerId: "provider-added",
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
  };
}

describe("ModelsPage", () => {
  it("renders guada-style provider sections from all model providers", async () => {
    const api = createApi();

    render(<ModelsPage api={api} />);

    expect(screen.getByRole("heading", { name: "模型管理" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "供应商列表" })).toBeInTheDocument();
    expect(await screen.findByText("已添加的供应商")).toBeInTheDocument();
    expect(screen.getByText("可添加的供应商")).toBeInTheDocument();

    const addedSection = screen.getByLabelText("已添加的供应商");
    expect(within(addedSection).getByRole("button", { name: /硅基流动/ })).toBeInTheDocument();
    expect(within(addedSection).getByText("提供高性价比的开源模型 API 服务，支持多种主流大语言模型。")).toBeInTheDocument();

    const availableSection = screen.getByLabelText("可添加的供应商");
    expect(within(availableSection).getByRole("button", { name: /Custom/ })).toBeInTheDocument();
    expect(within(availableSection).getByRole("button", { name: /火山引擎/ })).toBeInTheDocument();
    expect(within(availableSection).getByRole("button", { name: /DeepSeek/ })).toBeInTheDocument();
    expect(within(availableSection).getByRole("button", { name: /阿里云百炼/ })).toBeInTheDocument();
    expect(within(availableSection).getByText("OpenAI (Responses API)")).toBeInTheDocument();
    expect(within(availableSection).getAllByText("添加此供应商").length).toBeGreaterThan(1);

    await waitFor(() => expect(api.client.fetchAllModels).toHaveBeenCalledTimes(1));
  });
});
