import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import SchedulerPage, { type SchedulerPageApi } from ".";

function createApi(): SchedulerPageApi {
  return {
    client: {
      fetchScheduledTasks: vi.fn(async () => ({
        items: [],
        total: 0,
      })),
      createScheduledTask: vi.fn(async (task) => ({
        id: "task-1",
        userId: "user-1",
        enabled: true,
        lastRunAt: null,
        nextRunAt: "2026-06-30T01:00:00.000Z",
        createdAt: "2026-06-29T08:00:00.000Z",
        updatedAt: "2026-06-29T08:00:00.000Z",
        executionCount: 0,
        ...task,
      })),
      fetchCharacters: vi.fn(async () => ({
        items: [
          {
            id: "character-1",
            userId: "user-1",
            title: "智能助手",
            type: "private" as const,
            description: "通用助手",
            isActive: true,
            createdAt: "2026-06-29T08:00:00.000Z",
            updatedAt: "2026-06-29T08:00:00.000Z",
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
            ],
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      })),
      fetchSessions: vi.fn(async () => ({
        items: [
          {
            id: "session-1",
            title: "已有会话",
            userId: "user-1",
            characterId: "character-1",
            modelId: "model-1",
            settings: {},
            createdAt: "2026-06-29T08:00:00.000Z",
            updatedAt: "2026-06-29T08:00:00.000Z",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      })),
    },
  };
}

function renderScheduler(api: SchedulerPageApi = createApi()) {
  return render(
    <MemoryRouter>
      <SchedulerPage api={api} />
    </MemoryRouter>,
  );
}

describe("SchedulerPage", () => {
  it("renders the guada-style scheduler empty state", async () => {
    const api = createApi();
    renderScheduler(api);

    expect(screen.getByRole("heading", { name: "定时任务" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建任务" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "刷新" })).toBeInTheDocument();
    expect(await screen.findByText("暂无定时任务")).toBeInTheDocument();
    expect(screen.getByText('点击"新建任务"开始创建')).toBeInTheDocument();
    expect(api.client.fetchScheduledTasks).toHaveBeenCalledTimes(1);
  });

  it("opens the guada-style create task dialog and validates required fields", async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderScheduler(api);

    await user.click(screen.getByRole("button", { name: "新建任务" }));

    const dialog = screen.getByRole("dialog", { name: "新建任务" });
    expect(within(dialog).getByLabelText("任务名称")).toHaveAttribute("placeholder", "例如：每日早报");
    expect(within(dialog).getByLabelText("提示词")).toHaveAttribute("placeholder", "输入发送给 AI 的提示词内容");
    expect(within(dialog).getByRole("button", { name: "周期" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "每日" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("时间")).toHaveValue("09:00");
    expect(await within(dialog).findByRole("combobox", { name: "助手" })).toHaveTextContent("智能助手");
    expect(within(dialog).getByRole("combobox", { name: "模型" })).toHaveTextContent("DeepSeek-V3.2");

    await user.click(within(dialog).getByRole("button", { name: "保存" }));

    expect(within(dialog).getByText("请填写任务名称")).toBeInTheDocument();
    expect(api.client.createScheduledTask).not.toHaveBeenCalled();
  });

  it("creates a daily new-session task and refreshes the list after saving", async () => {
    const api = createApi();
    const user = userEvent.setup();
    vi.mocked(api.client.fetchScheduledTasks)
      .mockResolvedValueOnce({ items: [], total: 0 })
      .mockResolvedValueOnce({
        items: [
          {
            id: "task-1",
            userId: "user-1",
            name: "每日早报",
            prompt: "总结今天的计划",
            scheduleType: "cron",
            cronExpression: "30 8 * * *",
            targetMode: "new_session",
            characterId: "character-1",
            modelId: "model-1",
            enabled: true,
            lastRunAt: null,
            nextRunAt: "2026-06-30T00:30:00.000Z",
            createdAt: "2026-06-29T08:00:00.000Z",
            updatedAt: "2026-06-29T08:00:00.000Z",
            maxExecutions: null,
            executionCount: 0,
            maxRetries: 0,
            retryInterval: 60,
          },
        ],
        total: 1,
      });

    renderScheduler(api);

    await user.click(screen.getByRole("button", { name: "新建任务" }));
    const dialog = screen.getByRole("dialog", { name: "新建任务" });

    await user.type(within(dialog).getByLabelText("任务名称"), "每日早报");
    await user.type(within(dialog).getByLabelText("提示词"), "总结今天的计划");
    await user.clear(within(dialog).getByLabelText("时间"));
    await user.type(within(dialog).getByLabelText("时间"), "08:30");
    await user.click(within(dialog).getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(api.client.createScheduledTask).toHaveBeenCalledWith({
        name: "每日早报",
        prompt: "总结今天的计划",
        scheduleType: "cron",
        cronExpression: "30 8 * * *",
        targetMode: "new_session",
        characterId: "character-1",
        modelId: "model-1",
        enabled: true,
      });
    });
    await screen.findByText("每日早报");
    expect(api.client.fetchScheduledTasks).toHaveBeenCalledTimes(2);
  });

  it("refreshes scheduled tasks when clicking refresh", async () => {
    const api = createApi();
    const user = userEvent.setup();
    vi.mocked(api.client.fetchScheduledTasks)
      .mockResolvedValueOnce({ items: [], total: 0 })
      .mockResolvedValueOnce({
        items: [
          {
            id: "task-2",
            userId: "user-1",
            name: "刷新后的任务",
            prompt: "检查状态",
            scheduleType: "cron",
            cronExpression: "0 9 * * *",
            targetMode: "new_session",
            enabled: true,
            lastRunAt: null,
            nextRunAt: null,
            createdAt: "2026-06-29T08:00:00.000Z",
            updatedAt: "2026-06-29T08:00:00.000Z",
            maxExecutions: null,
            executionCount: 0,
            maxRetries: 0,
            retryInterval: 60,
          },
        ],
        total: 1,
      });

    renderScheduler(api);
    await screen.findByText("暂无定时任务");

    await user.click(screen.getByRole("button", { name: "刷新" }));

    expect(await screen.findByText("刷新后的任务")).toBeInTheDocument();
    expect(api.client.fetchScheduledTasks).toHaveBeenCalledTimes(2);
  });
});
