import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Brain,
  ChevronRight,
  FileImage,
  Folder,
  Lightbulb,
  PanelLeft,
  Paperclip,
  Search,
  Send,
  Settings,
  Star,
  Type,
  Check,
  X,
} from "lucide-react";
import { mosaicApi, type ApiClient, type SessionEventsService } from "@mosaic-dock/api-client";
import type { Model, ModelProvider } from "@mosaic-dock/shared";
import {
  SessionGroupManageDialog,
  type SessionGroup,
  type SessionGroupManageApi,
} from "../../components/session/SessionGroupManageDialog";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { useWorkspaceSidebar } from "../../layouts/WorkspaceLayout";

export interface NewSessionPageApi {
  client: {
    fetchSessionGroups: () => Promise<unknown>;
    fetchKnowledgeBases: () => Promise<unknown>;
    fetchSkills: () => Promise<unknown>;
    fetchAppearanceSettings: () => Promise<unknown>;
    fetchModels: ApiClient["fetchModels"];
    fetchCharacters: () => Promise<unknown>;
    fetchTeams: () => Promise<unknown>;
    fetchSessions: ApiClient["fetchSessions"];
    createSessionGroup: SessionGroupManageApi["createSessionGroup"];
    updateSessionGroup: SessionGroupManageApi["updateSessionGroup"];
    deleteSessionGroup: SessionGroupManageApi["deleteSessionGroup"];
    reorderSessionGroups: SessionGroupManageApi["reorderSessionGroups"];
  };
  sessionEvents: Pick<SessionEventsService, "connect" | "disconnect">;
}

interface NewSessionPageProps {
  api?: NewSessionPageApi;
}

const greetingText = "Hi，想聊些什么？";
const typewriterDelayMs = 100;
const typewriterLoopPauseMs = 1200;
const thinkingEffortOptions = [
  { value: "off", label: "不思考" },
  { value: "low", label: "低强度" },
  { value: "medium", label: "中等强度" },
  { value: "high", label: "高强度" },
  { value: "xhigh", label: "极致" },
] as const;

type ThinkingEffort = (typeof thinkingEffortOptions)[number]["value"];

export function NewSessionPage({ api = mosaicApi }: NewSessionPageProps) {
  const [draft, setDraft] = useState("");
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [displayedGreeting, setDisplayedGreeting] = useState("");
  const [modelProviders, setModelProviders] = useState<ModelProvider[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [modelPanelOpen, setModelPanelOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [thinkingEffort, setThinkingEffort] = useState<ThinkingEffort>("off");
  const [thinkingPanelOpen, setThinkingPanelOpen] = useState(false);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [workspaceDraft, setWorkspaceDraft] = useState("");
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [sessionGroups, setSessionGroups] = useState<SessionGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupSelectorOpen, setGroupSelectorOpen] = useState(false);
  const [groupManageOpen, setGroupManageOpen] = useState(false);
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  const thinkingSelectorRef = useRef<HTMLDivElement>(null);
  const { sidebarOpen, toggleSidebar } = useWorkspaceSidebar();

  const models = flattenModels(modelProviders);
  const selectedModel = models.find(({ model }) => model.id === selectedModelId)?.model ?? models[0]?.model ?? null;
  const selectedModelName = selectedModel?.modelName ?? "选择模型";
  const filteredProviderGroups = filterProviderGroups(modelProviders, modelSearch);
  const workspaceDisplay = workspacePath ? getPathBaseName(workspacePath) : "自动创建";
  const selectedGroupName =
    sessionGroups.find((group) => group.id === selectedGroupId)?.name ?? "任务列表";
  const sessionGroupApi: SessionGroupManageApi = useMemo(
    () => ({
      createSessionGroup: (data) => api.client.createSessionGroup(data),
      updateSessionGroup: (groupId, data) => api.client.updateSessionGroup(groupId, data),
      deleteSessionGroup: (groupId) => api.client.deleteSessionGroup(groupId),
      reorderSessionGroups: (groupIds) => api.client.reorderSessionGroups(groupIds),
    }),
    [api],
  );

  useEffect(() => {
    let cancelled = false;

    api.sessionEvents.connect();

    async function bootstrap() {
      try {
        const [groupsResponse, , , , modelsResponse] = await Promise.all([
          api.client.fetchSessionGroups(),
          api.client.fetchKnowledgeBases(),
          api.client.fetchSkills(),
          api.client.fetchAppearanceSettings(),
          api.client.fetchModels(),
          api.client.fetchCharacters(),
          api.client.fetchTeams(),
          api.client.fetchSessions({ skip: 0, limit: 10, groupId: null }),
        ]);

        if (!cancelled) {
          const providers = modelsResponse.items ?? [];
          setSessionGroups(normalizeSessionGroups(groupsResponse));
          setModelProviders(providers);
          setSelectedModelId((current) => current ?? flattenModels(providers)[0]?.model.id ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          setBootstrapError(error instanceof Error ? error.message : "新建对话初始化失败");
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
      api.sessionEvents.disconnect();
    };
  }, [api]);

  useEffect(() => {
    let nextLength = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    setDisplayedGreeting("");

    function typeNextCharacter() {
      nextLength += 1;
      setDisplayedGreeting(greetingText.slice(0, nextLength));

      if (nextLength >= greetingText.length) {
        timer = setTimeout(() => {
          nextLength = 0;
          setDisplayedGreeting("");
          timer = setTimeout(typeNextCharacter, typewriterDelayMs);
        }, typewriterLoopPauseMs);
        return;
      }

      timer = setTimeout(typeNextCharacter, typewriterDelayMs);
    }

    timer = setTimeout(typeNextCharacter, typewriterDelayMs);

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    if (!modelPanelOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!modelSelectorRef.current?.contains(target)) {
        setModelPanelOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [modelPanelOpen]);

  useEffect(() => {
    if (!thinkingPanelOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!thinkingSelectorRef.current?.contains(target)) {
        setThinkingPanelOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [thinkingPanelOpen]);

  function openWorkspaceDialog() {
    setWorkspaceDraft(workspacePath ?? "");
    setWorkspaceError(null);
    setWorkspaceDialogOpen(true);
  }

  function confirmWorkspacePath() {
    const nextPath = workspaceDraft.trim();

    if (nextPath && !isAbsolutePath(nextPath)) {
      setWorkspaceError("工作目录必须是绝对路径");
      return;
    }

    setWorkspacePath(nextPath || null);
    setWorkspaceError(null);
    setWorkspaceDialogOpen(false);
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-background">
      <header className="flex h-14 items-center gap-3 px-5 text-sm font-semibold text-foreground">
        <button
          type="button"
          aria-label={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
          title={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground"
          onClick={toggleSidebar}
        >
          <PanelLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        新建对话
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-24">
        <section className="w-full max-w-[800px]" data-testid="new-session-input-panel">
          <div className="mb-12 flex items-center justify-center gap-6">
            <div className="grid h-20 w-20 place-items-center rounded-3xl bg-pink-500 text-white shadow-lg shadow-pink-500/25">
              <Brain className="h-10 w-10" aria-hidden="true" />
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground">
              <span data-testid="new-session-greeting">{displayedGreeting}</span>
              <span className="ml-2 inline-block h-10 w-px translate-y-2 animate-pulse bg-foreground" />
            </h1>
          </div>

          <button
            type="button"
            className="-mb-6 flex w-full items-center gap-3 rounded-2xl bg-gray-100 p-2 pb-8 text-left transition-colors hover:bg-gray-100 dark:bg-[#232428] dark:hover:bg-[#232428]"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded bg-linear-to-br from-cyan-100 to-pink-100 text-xl">
              👩🏻‍💻
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">智能助手</p>
              <p className="truncate text-xs text-muted-foreground">
                一个友好、专业的 AI 助手，可以帮助你解答各种问题。
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </button>

          <div
            className="relative rounded-[22px] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)] ring-1 ring-gray-200/80 transition-shadow duration-200 focus-within:shadow-[0_2px_22px_rgba(0,0,0,0.11)] dark:bg-[#232428] dark:ring-[#2e3035] dark:shadow-none dark:focus-within:shadow-none"
            data-testid="new-session-input-card"
          >
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="按 / 使用技能，Shift+Enter 换行"
              rows={4}
              className="min-h-20 border-0 bg-transparent px-0 text-base shadow-none focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <div className="mt-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="relative" ref={thinkingSelectorRef}>
                  <button
                    type="button"
                    className={[
                      "inline-flex items-center gap-1 rounded px-1 py-1 text-sm transition-colors hover:text-foreground",
                      thinkingEffort !== "off" ? "text-pink-500" : "",
                    ].join(" ")}
                    onClick={() => setThinkingPanelOpen((open) => !open)}
                  >
                    <Lightbulb className="h-4 w-4" aria-hidden="true" />
                    {getThinkingEffortLabel(thinkingEffort)}
                  </button>
                  {thinkingPanelOpen ? (
                    <div className="absolute bottom-9 left-0 z-20 w-[180px] rounded-lg bg-white p-4 shadow-[0_12px_32px_rgba(0,0,0,0.15),0_4px_8px_rgba(0,0,0,0.1)] ring-1 ring-gray-200 dark:bg-[#232428] dark:ring-[#2e3035]">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <Lightbulb className="h-4 w-4 text-slate-500" aria-hidden="true" />
                        思考强度
                      </div>
                      <div className="space-y-1">
                        {thinkingEffortOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={[
                              "flex w-full items-center justify-between rounded px-2 py-1.5 text-sm transition-colors",
                              option.value === thinkingEffort
                                ? "bg-pink-50"
                                : "hover:bg-gray-50",
                            ].join(" ")}
                            onClick={() => {
                              setThinkingEffort(option.value);
                              setThinkingPanelOpen(false);
                            }}
                          >
                            <span>{option.label}</span>
                            <span className="text-xs text-slate-400">{option.value}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                <button type="button" aria-label="添加图片" className="hover:text-foreground">
                  <FileImage className="h-5 w-5" aria-hidden="true" />
                </button>
                <button type="button" aria-label="上传附件" className="hover:text-foreground">
                  <Paperclip className="h-5 w-5" aria-hidden="true" />
                </button>
                <button type="button" aria-label="搜索知识库" className="hover:text-foreground">
                  <Search className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="relative flex items-center gap-3" ref={modelSelectorRef}>
                <button
                  type="button"
                  className="inline-flex max-w-[200px] items-center gap-1.5 overflow-hidden rounded-full px-2 py-1 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                  onClick={() => setModelPanelOpen((open) => !open)}
                >
                  <ModelAvatar providerName={getProviderNameForModel(modelProviders, selectedModel)} />
                  <span className="truncate">{selectedModelName}</span>
                </button>
                {modelPanelOpen ? (
                  <div className="absolute bottom-11 right-0 z-20 w-80 rounded-lg bg-white p-4 shadow-[0_12px_32px_rgba(0,0,0,0.15),0_4px_8px_rgba(0,0,0,0.1)] ring-1 ring-gray-200 dark:bg-[#232428] dark:ring-[#2e3035]">
                    <label className="relative block">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="search"
                        value={modelSearch}
                        onChange={(event) => setModelSearch(event.target.value)}
                        placeholder="搜索模型..."
                        className="h-8 w-full rounded border border-gray-200 bg-white pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-gray-300"
                      />
                    </label>
                    <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                      {filteredProviderGroups.length > 0 ? (
                        filteredProviderGroups.map(({ provider, models }) => (
                          <div key={provider.id}>
                            <div className="mb-1 px-1 text-xs font-semibold text-amber-500">
                              {provider.name}
                            </div>
                            <div className="space-y-1">
                              {models.map((model) => (
                                <button
                                  key={model.id}
                                  type="button"
                                  className={[
                                    "flex w-full items-center gap-2 rounded p-2 text-left transition-colors",
                                    model.id === selectedModel?.id
                                      ? "bg-pink-50"
                                      : "hover:bg-gray-50",
                                  ].join(" ")}
                                  onClick={() => {
                                    setSelectedModelId(model.id);
                                    setModelPanelOpen(false);
                                  }}
                                >
                                  <ModelAvatar providerName={provider.name} className="h-8 w-8" />
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-semibold text-slate-800">
                                      {model.modelName}
                                    </div>
                                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                                      <span className="inline-flex items-center gap-0.5 rounded border border-gray-100 bg-gray-50 px-1.5 py-0.5">
                                        <Type className="h-3 w-3" aria-hidden="true" />
                                        <ChevronRight className="h-2.5 w-2.5" aria-hidden="true" />
                                        <Type className="h-3 w-3" aria-hidden="true" />
                                      </span>
                                      <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
                                    </div>
                                  </div>
                                  <Star className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                                </button>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-6 text-center text-xs text-slate-400">未找到匹配的模型</div>
                      )}
                    </div>
                  </div>
                ) : null}
                <button type="button" aria-label="模型设置" className="text-muted-foreground hover:text-foreground">
                  <Settings className="h-5 w-5" aria-hidden="true" />
                </button>
                <Button size="icon" className="rounded-full bg-pink-500 hover:bg-pink-500/90" disabled={!draft.trim()}>
                  <Send className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-slate-100 hover:text-foreground"
              onClick={openWorkspaceDialog}
            >
              <Folder className="h-4 w-4" aria-hidden="true" />
              工作目录：{workspaceDisplay}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-slate-100 hover:text-foreground"
              onClick={() => setGroupSelectorOpen(true)}
            >
              分组：{selectedGroupName}
            </button>
          </div>

          {bootstrapError ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {bootstrapError}
            </p>
          ) : null}
        </section>
      </main>
      {workspaceDialogOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4">
          <div className="w-full max-w-[460px] rounded-xl bg-white p-5 shadow-[0_12px_32px_rgba(0,0,0,0.15),0_4px_8px_rgba(0,0,0,0.1)] ring-1 ring-gray-200">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">工作目录设置</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                设置当前会话的工作目录路径。留空则使用系统默认目录。
              </p>
            </div>
            <label className="block text-sm font-medium text-slate-700">
              工作目录路径
              <input
                value={workspaceDraft}
                onChange={(event) => {
                  setWorkspaceDraft(event.target.value);
                  setWorkspaceError(null);
                }}
                placeholder="请输入绝对路径，例如 /Users/name/project"
                className="mt-2 h-10 w-full rounded-md border border-gray-200 px-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-gray-300"
              />
            </label>
            {workspaceError ? (
              <p className="mt-2 text-sm text-red-600">{workspaceError}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100"
                onClick={() => setWorkspaceDialogOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-md bg-pink-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pink-500/90"
                onClick={confirmWorkspacePath}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {groupSelectorOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4">
          <div
            role="dialog"
            aria-labelledby="group-selector-title"
            className="w-full max-w-[360px] rounded-xl bg-white p-5 shadow-[0_12px_32px_rgba(0,0,0,0.15),0_4px_8px_rgba(0,0,0,0.1)] ring-1 ring-gray-200"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="group-selector-title" className="text-base font-semibold text-slate-900">请选择分组</h2>
              <button
                type="button"
                aria-label="关闭分组选择"
                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                onClick={() => setGroupSelectorOpen(false)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-1 py-2">
              {[
                { id: null, name: "任务列表" },
                ...sessionGroups.map((group) => ({ id: group.id, name: group.name })),
              ].map((group) => (
                <button
                  key={group.id ?? "ungrouped"}
                  type="button"
                  className={[
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-all duration-200",
                    selectedGroupId === group.id
                      ? "bg-slate-100 text-foreground"
                      : "text-muted-foreground hover:bg-slate-100 hover:text-foreground",
                  ].join(" ")}
                  onClick={() => {
                    setSelectedGroupId(group.id);
                    setGroupSelectorOpen(false);
                  }}
                >
                  <Folder className="h-4 w-4" aria-hidden="true" />
                  <span className="flex-1">{group.name}</span>
                  {selectedGroupId === group.id ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : null}
                </button>
              ))}
            </div>
            <div className="mt-3 border-t border-gray-100 pt-3">
              <button
                type="button"
                className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-foreground"
                onClick={() => {
                  setGroupSelectorOpen(false);
                  setGroupManageOpen(true);
                }}
              >
                管理分组
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <SessionGroupManageDialog
        open={groupManageOpen}
        groups={sessionGroups}
        api={sessionGroupApi}
        onClose={() => setGroupManageOpen(false)}
        onGroupsChange={(nextGroups) => {
          setSessionGroups(nextGroups);
          setSelectedGroupId((current) =>
            current && nextGroups.some((group) => group.id === current) ? current : null,
          );
        }}
      />
    </div>
  );
}

function flattenModels(providers: ModelProvider[]): Array<{ provider: ModelProvider; model: Model }> {
  return providers.flatMap((provider) =>
    (provider.models ?? [])
      .filter((model) => model.isActive !== false)
      .map((model) => ({ provider, model })),
  );
}

function filterProviderGroups(providers: ModelProvider[], searchText: string) {
  const keyword = searchText.trim().toLowerCase();

  return providers
    .map((provider) => ({
      provider,
      models: (provider.models ?? []).filter((model) => {
        if (model.isActive === false) return false;
        if (!keyword) return true;
        return (
          model.modelName.toLowerCase().includes(keyword) ||
          model.description?.toLowerCase().includes(keyword)
        );
      }),
    }))
    .filter((group) => group.models.length > 0);
}

function getProviderNameForModel(providers: ModelProvider[], model: Model | null): string | undefined {
  if (!model) return undefined;
  return providers.find((provider) => provider.id === model.providerId)?.name ?? model.providerName;
}

function getThinkingEffortLabel(effort: ThinkingEffort): string {
  return thinkingEffortOptions.find((option) => option.value === effort)?.label ?? "不思考";
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path);
}

function getPathBaseName(path: string): string {
  const normalized = path.replace(/[\\/]+$/, "");
  return normalized.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

function normalizeSessionGroups(response: unknown): SessionGroup[] {
  const items =
    Array.isArray(response)
      ? response
      : response && typeof response === "object" && "items" in response
        ? (response as { items?: unknown }).items
        : [];

  if (!Array.isArray(items)) return [];

  return items
    .filter((item): item is { id: string; name: string } => {
      return (
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        "name" in item &&
        typeof (item as { id: unknown }).id === "string" &&
        typeof (item as { name: unknown }).name === "string"
      );
    })
    .map((item) => ({ id: item.id, name: item.name }));
}

function ModelAvatar({
  providerName,
  className = "h-5 w-5",
}: {
  providerName?: string;
  className?: string;
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded bg-blue-50 text-blue-600 ${className}`}
      title={providerName ?? "模型"}
    >
      <Bot className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

export default NewSessionPage;
