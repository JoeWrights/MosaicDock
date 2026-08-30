import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarClock, CheckCircle2, Plus, RefreshCw, X } from "lucide-react";
import {
  mosaicApi,
  type ApiClient,
  type CreateScheduledTaskRequest,
  type ScheduledTask,
} from "@mosaic-dock/api-client";
import type { Character, ModelProvider, Session } from "@mosaic-dock/shared";
import { WorkspacePageHeader } from "../../components/layout/WorkspacePageHeader";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../lib/utils";

export interface SchedulerPageApi {
  client: Pick<
    ApiClient,
    | "fetchScheduledTasks"
    | "createScheduledTask"
    | "fetchCharacters"
    | "fetchModels"
    | "fetchSessions"
  >;
}

interface SchedulerPageProps {
  api?: SchedulerPageApi;
}

type SchedulePreset = "monthly" | "weekly" | "daily";
type TargetMode = "new_session" | "existing_session";

interface TaskFormState {
  name: string;
  prompt: string;
  schedulePreset: SchedulePreset;
  time: string;
  targetMode: TargetMode;
  targetSessionId: string;
  characterId: string;
  modelId: string;
  maxExecutions: string;
  maxRetries: string;
  retryInterval: string;
}

interface CharacterOption {
  id: string;
  title: string;
}

interface SessionOption {
  id: string;
  title: string;
}

interface ModelOption {
  id: string;
  label: string;
}

const defaultForm: TaskFormState = {
  name: "",
  prompt: "",
  schedulePreset: "daily",
  time: "09:00",
  targetMode: "new_session",
  targetSessionId: "",
  characterId: "",
  modelId: "",
  maxExecutions: "",
  maxRetries: "",
  retryInterval: "",
};

export function SchedulerPage({ api = mosaicApi }: SchedulerPageProps) {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function loadTasks(mode: "initial" | "refresh" = "refresh") {
    if (mode === "initial") {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      const response = await api.client.fetchScheduledTasks();
      setTasks(response.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "定时任务加载失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadTasks("initial");
  }, [api]);

  return (
    <div className="min-h-screen bg-[#f7f8fa] px-5 pb-5 text-foreground dark:bg-[#1e1f23] dark:text-[#e8e9ed]">
      <header className="border-b border-slate-200 pb-4 dark:border-[#2f3136]">
        <WorkspacePageHeader
          title="定时任务"
          actions={
            <div className="flex items-center gap-2">
              <Button
                className="h-8 rounded-md bg-pink-500 px-3 text-sm text-white shadow-none hover:bg-pink-500/90"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                新建任务
              </Button>
              <Button
                variant="secondary"
                className="h-8 rounded-md px-3 text-sm shadow-none"
                disabled={loading || refreshing}
                onClick={() => void loadTasks("refresh")}
              >
                <RefreshCw
                  className={cn("h-4 w-4", refreshing ? "animate-spin" : "")}
                  aria-hidden="true"
                />
                {refreshing ? "刷新中" : "刷新"}
              </Button>
            </div>
          }
        />
      </header>

      <main className="pt-5">
        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        {loading ? (
          <section className="grid min-h-[176px] place-items-center rounded-lg border border-slate-200 bg-white text-center dark:border-[#2f3136] dark:bg-[#232428]">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
          </section>
        ) : tasks.length === 0 ? (
          <section className="grid min-h-[176px] place-items-center rounded-lg border border-slate-200 bg-white text-center dark:border-[#2f3136] dark:bg-[#232428]">
            <div className="flex flex-col items-center">
              <CalendarClock className="h-8 w-8 text-muted-foreground/45" aria-hidden="true" />
              <h2 className="mt-4 text-sm font-medium text-muted-foreground">暂无定时任务</h2>
              <p className="mt-2 text-xs text-muted-foreground/75">点击"新建任务"开始创建</p>
            </div>
          </section>
        ) : (
          <section className="grid gap-3">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </section>
        )}
      </main>

      {dialogOpen ? (
        <CreateTaskDialog
          api={api}
          onClose={() => setDialogOpen(false)}
          onCreated={() => {
            setDialogOpen(false);
            void loadTasks("refresh");
          }}
        />
      ) : null}
    </div>
  );
}

function TaskCard({ task }: { task: ScheduledTask }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2f3136] dark:bg-[#232428]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{task.name}</h2>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{task.prompt}</p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs",
            task.enabled
              ? "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-300"
              : "bg-slate-100 text-muted-foreground dark:bg-[#2a2c30]",
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          {task.enabled ? "已启用" : "已停用"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded bg-slate-100 px-2 py-1 dark:bg-[#2a2c30]">{formatSchedule(task)}</span>
        <span className="rounded bg-slate-100 px-2 py-1 dark:bg-[#2a2c30]">
          {task.targetMode === "new_session" ? "新建会话" : "已有会话"}
        </span>
        {task.nextRunAt ? (
          <span className="rounded bg-slate-100 px-2 py-1 dark:bg-[#2a2c30]">
            下次执行：{formatDateTime(task.nextRunAt)}
          </span>
        ) : null}
      </div>
    </article>
  );
}

function CreateTaskDialog({
  api,
  onClose,
  onCreated,
}: {
  api: SchedulerPageApi;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<TaskFormState>(defaultForm);
  const [characters, setCharacters] = useState<CharacterOption[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const characterOptions = useMemo(
    () => [
      { value: "", label: "请选择助手" },
      ...characters.map((character) => ({ value: character.id, label: character.title })),
    ],
    [characters],
  );
  const modelOptions = useMemo(
    () => [
      { value: "", label: "可选，指定模型" },
      ...models.map((model) => ({ value: model.id, label: model.label })),
    ],
    [models],
  );
  const sessionOptions = useMemo(
    () => [
      { value: "", label: "请选择已有会话" },
      ...sessions.map((session) => ({ value: session.id, label: session.title })),
    ],
    [sessions],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      setOptionsLoading(true);
      setError(null);
      try {
        const [charactersResponse, modelsResponse, sessionsResponse] = await Promise.all([
          api.client.fetchCharacters(),
          api.client.fetchModels(),
          api.client.fetchSessions({ skip: 0, limit: 20, groupId: null }),
        ]);
        if (cancelled) return;

        const nextCharacters = normalizeCharacters(charactersResponse);
        const nextModels = flattenTextModels(modelsResponse.items ?? []);
        const nextSessions = normalizeSessions(sessionsResponse.items ?? []);

        setCharacters(nextCharacters);
        setModels(nextModels);
        setSessions(nextSessions);
        setForm((current) => ({
          ...current,
          characterId: current.characterId || nextCharacters[0]?.id || "",
          modelId: current.modelId || nextModels[0]?.id || "",
          targetSessionId: current.targetSessionId || nextSessions[0]?.id || "",
        }));
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "新建任务配置加载失败");
        }
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, [api]);

  function patchForm(patch: Partial<TaskFormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function saveTask() {
    const validation = validateForm(form);
    if (validation) {
      setError(validation);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.client.createScheduledTask(buildCreatePayload(form));
      onCreated();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "定时任务保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-70 grid place-items-center bg-black/35 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scheduler-create-title"
        className="flex max-h-[82vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_18px_52px_rgba(0,0,0,0.22)] ring-1 ring-slate-200 dark:bg-[#232428] dark:ring-[#2f3136]"
      >
        <header className="flex items-center justify-between px-6 py-5">
          <h2 id="scheduler-create-title" className="text-lg font-semibold">
            新建任务
          </h2>
          <button
            type="button"
            aria-label="关闭"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">
          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          <div className="space-y-4">
            <FormRow label="任务名称" required>
              <Input
                aria-label="任务名称"
                value={form.name}
                placeholder="例如：每日早报"
                onChange={(event) => patchForm({ name: event.target.value })}
              />
            </FormRow>

            <FormRow label="提示词" required>
              <Textarea
                aria-label="提示词"
                className="min-h-[86px]"
                value={form.prompt}
                placeholder="输入发送给 AI 的提示词内容"
                onChange={(event) => patchForm({ prompt: event.target.value })}
              />
            </FormRow>

            <FormRow label="执行时间" required>
              <div className="mb-3 flex flex-wrap items-center gap-4 text-sm font-medium">
                <button type="button" className="rounded bg-pink-500 px-3 py-1.5 text-white">
                  周期
                </button>
                <button type="button" className="text-muted-foreground hover:text-foreground">
                  间隔
                </button>
                <button type="button" className="text-muted-foreground hover:text-foreground">
                  一次性
                </button>
                <button type="button" className="text-muted-foreground hover:text-foreground">
                  高级
                </button>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-[#1f2024]">
                <div className="flex flex-wrap items-center gap-2">
                  <PillButton
                    active={form.schedulePreset === "monthly"}
                    onClick={() => patchForm({ schedulePreset: "monthly" })}
                  >
                    每月
                  </PillButton>
                  <PillButton
                    active={form.schedulePreset === "weekly"}
                    onClick={() => patchForm({ schedulePreset: "weekly" })}
                  >
                    每周
                  </PillButton>
                  <PillButton
                    active={form.schedulePreset === "daily"}
                    onClick={() => patchForm({ schedulePreset: "daily" })}
                  >
                    每日
                  </PillButton>
                  <span className="ml-2 text-sm font-medium">时间</span>
                  <Input
                    aria-label="时间"
                    type="time"
                    className="h-9 w-[128px] bg-white dark:bg-[#232428]"
                    value={form.time}
                    onChange={(event) => patchForm({ time: event.target.value })}
                  />
                </div>
              </div>
            </FormRow>

            <FormRow label="执行目标" required>
              <div className="flex flex-wrap items-center gap-2">
                <PillButton
                  active={form.targetMode === "new_session"}
                  onClick={() => patchForm({ targetMode: "new_session" })}
                >
                  新建会话
                </PillButton>
                <PillButton
                  active={form.targetMode === "existing_session"}
                  onClick={() => patchForm({ targetMode: "existing_session" })}
                >
                  已有会话
                </PillButton>
              </div>
              {form.targetMode === "existing_session" ? (
                <Select
                  className="mt-3"
                  ariaLabel="已有会话"
                  value={form.targetSessionId}
                  options={sessionOptions}
                  onValueChange={(targetSessionId) => patchForm({ targetSessionId })}
                  disabled={optionsLoading}
                />
              ) : null}
            </FormRow>

            <FormRow label="助手">
              <Select
                ariaLabel="助手"
                value={form.characterId}
                options={characterOptions}
                onValueChange={(characterId) => patchForm({ characterId })}
                disabled={optionsLoading}
              />
            </FormRow>

            <FormRow label="模型">
              <Select
                ariaLabel="模型"
                value={form.modelId}
                options={modelOptions}
                onValueChange={(modelId) => patchForm({ modelId })}
                disabled={optionsLoading}
              />
            </FormRow>

            <div className="pt-1">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="h-px w-12 bg-slate-200 dark:bg-[#2f3136]" />
                高级配置
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <label className="text-sm font-medium">
                  最大执行次数
                  <Input
                    aria-label="最大执行次数"
                    className="mt-2"
                    type="number"
                    min={1}
                    value={form.maxExecutions}
                    placeholder="无限"
                    onChange={(event) => patchForm({ maxExecutions: event.target.value })}
                  />
                </label>
                <label className="text-sm font-medium">
                  最大重试次数
                  <Input
                    aria-label="最大重试次数"
                    className="mt-2"
                    type="number"
                    min={0}
                    value={form.maxRetries}
                    placeholder="0"
                    onChange={(event) => patchForm({ maxRetries: event.target.value })}
                  />
                </label>
                <label className="text-sm font-medium">
                  重试间隔（秒）
                  <Input
                    aria-label="重试间隔（秒）"
                    className="mt-2"
                    type="number"
                    min={1}
                    value={form.retryInterval}
                    placeholder="60"
                    onChange={(event) => patchForm({ retryInterval: event.target.value })}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 justify-end gap-3 border-t border-slate-100 px-6 py-4 dark:border-[#2f3136]">
          <Button variant="secondary" className="shadow-none" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button
            className="bg-pink-500 text-white shadow-none hover:bg-pink-500/90"
            disabled={optionsLoading || saving}
            onClick={() => void saveTask()}
          >
            {saving ? "保存中..." : "保存"}
          </Button>
        </footer>
      </div>
    </div>
  );
}

function FormRow({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-[80px_1fr]">
      <div className="pt-2 text-sm font-medium">
        {required ? <span className="mr-1 text-pink-500">*</span> : null}
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-pink-500 text-white"
          : "bg-white text-muted-foreground hover:text-foreground dark:bg-[#232428]",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function validateForm(form: TaskFormState): string | null {
  if (!form.name.trim()) return "请填写任务名称";
  if (!form.prompt.trim()) return "请填写提示词";
  if (!isValidTime(form.time)) return "请选择有效执行时间";
  if (form.targetMode === "existing_session" && !form.targetSessionId) return "请选择已有会话";
  return null;
}

function buildCreatePayload(form: TaskFormState): CreateScheduledTaskRequest {
  const payload: CreateScheduledTaskRequest = {
    name: form.name.trim(),
    prompt: form.prompt.trim(),
    scheduleType: "cron",
    cronExpression: toCronExpression(form.schedulePreset, form.time),
    targetMode: form.targetMode,
    enabled: true,
  };

  if (form.targetMode === "existing_session" && form.targetSessionId) {
    payload.targetSessionId = form.targetSessionId;
  }
  if (form.characterId) payload.characterId = form.characterId;
  if (form.modelId) payload.modelId = form.modelId;
  if (form.maxExecutions) payload.maxExecutions = Number(form.maxExecutions);
  if (form.maxRetries) payload.maxRetries = Number(form.maxRetries);
  if (form.retryInterval) payload.retryInterval = Number(form.retryInterval);

  return payload;
}

function toCronExpression(preset: SchedulePreset, time: string): string {
  const [hour = "9", minute = "0"] = time.split(":");
  const normalizedHour = String(Number(hour));
  const normalizedMinute = String(Number(minute));

  if (preset === "monthly") return `${normalizedMinute} ${normalizedHour} 1 * *`;
  if (preset === "weekly") return `${normalizedMinute} ${normalizedHour} * * 1`;
  return `${normalizedMinute} ${normalizedHour} * * *`;
}

function isValidTime(time: string): boolean {
  return /^\d{2}:\d{2}$/.test(time);
}

function normalizeCharacters(response: Awaited<ReturnType<ApiClient["fetchCharacters"]>>): CharacterOption[] {
  const items = Array.isArray(response) ? response : response.items ?? [];
  return (items as Character[])
    .filter((character) => character.id && character.title)
    .map((character) => ({ id: character.id, title: character.title }));
}

function normalizeSessions(items: Session[]): SessionOption[] {
  return items
    .filter((session) => session.id)
    .map((session) => ({ id: session.id, title: session.title || "未命名会话" }));
}

function flattenTextModels(providers: ModelProvider[]): ModelOption[] {
  return providers.flatMap((provider) =>
    (provider.models ?? [])
      .filter((model) => model.modelType === "text" && model.isActive !== false)
      .map((model) => ({
        id: model.id,
        label: getCompactModelName(model.modelName),
      })),
  );
}

function getCompactModelName(modelName: string): string {
  return modelName.includes("/") ? modelName.split("/").pop() || modelName : modelName;
}

function formatSchedule(task: ScheduledTask): string {
  if (task.scheduleType === "once" && task.executeAt) return `一次性：${formatDateTime(task.executeAt)}`;
  return task.cronExpression || "周期任务";
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default SchedulerPage;
