import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BotsManagementPage, type BotsManagementPageApi } from ".";

function createApi(overrides: Partial<BotsManagementPageApi["client"]> = {}): BotsManagementPageApi {
  return {
    client: {
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
});
