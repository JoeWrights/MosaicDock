import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  FileText,
  FileImage,
  Folder,
  Lightbulb,
  PanelLeft,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Settings,
  Star,
  Type,
  X,
} from "lucide-react";
import { useLocation, useParams } from "react-router-dom";
import {
  mosaicApi,
  type ApiClient,
  type ChatStreamService,
  type StreamEvent,
  type WorkspaceFileResponse,
  type WorkspaceTreeNode,
} from "@mosaic-dock/api-client";
import type { Message, Model, ModelProvider, PaginatedResponse, Session } from "@mosaic-dock/shared";
import { Button } from "../../components/ui/button";
import { ChatMessageItem } from "../../components/chat/ChatMessageItem";
import { MarkdownContent } from "../../components/chat/MarkdownContent";
import { getLanguageFromFileName, highlightCode } from "../../components/chat/code-highlight";
import { EmptyState } from "../../components/ui/empty-state";
import { Spinner } from "../../components/ui/spinner";
import { Textarea } from "../../components/ui/textarea";
import { useWorkspaceSidebar } from "../../layouts/WorkspaceLayout";
import { cn } from "../../lib/utils";

export interface ChatWorkspaceApi {
  client: Pick<
    ApiClient,
    | "fetchSession"
    | "fetchSessionMessages"
    | "updateMessage"
    | "deleteMessage"
    | "updateMessageActiveContent"
    | "fetchMessageContentToolDetails"
    | "fetchWorkspaceTree"
    | "fetchWorkspaceChildren"
    | "fetchWorkspaceFile"
    | "fetchModels"
    | "updateSession"
  >;
  chatStream: Pick<ChatStreamService, "chat" | "cancelResponse">;
}

interface ChatRouteState {
  pendingUserMessage?: Message;
}

interface ChatWorkspaceProps {
  api?: ChatWorkspaceApi;
}

const thinkingEffortOptions = [
  { value: "off", label: "不思考" },
  { value: "low", label: "低强度" },
  { value: "medium", label: "中等强度" },
  { value: "high", label: "高强度" },
  { value: "xhigh", label: "极致" },
] as const;

type ThinkingEffort = (typeof thinkingEffortOptions)[number]["value"];
const workspacePanelWidthStorageKey = "chat-workspace-panel-width";
const defaultWorkspacePanelWidth = 280;
const minWorkspacePanelWidth = 220;
const maxWorkspacePanelWidth = 520;

interface SelectedWorkspaceFile {
  node: WorkspaceTreeNode;
  file: WorkspaceFileResponse | null;
  loading: boolean;
  error: string | null;
}

export function ChatWorkspace({ api = mosaicApi }: ChatWorkspaceProps) {
  const { sessionId } = useParams();
  const { sidebarOpen, toggleSidebar } = useWorkspaceSidebar();
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaceTree, setWorkspaceTree] = useState<WorkspaceTreeNode[]>([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [selectedWorkspaceFile, setSelectedWorkspaceFile] = useState<SelectedWorkspaceFile | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false);
  const [workspacePanelWidth, setWorkspacePanelWidth] = useState(() => getStoredWorkspacePanelWidth());
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [composerEditingMessage, setComposerEditingMessage] = useState<Message | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [deletingMessage, setDeletingMessage] = useState<Message | null>(null);
  const [modelProviders, setModelProviders] = useState<ModelProvider[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [modelPanelOpen, setModelPanelOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [thinkingEffort, setThinkingEffort] = useState<ThinkingEffort>("off");
  const [thinkingPanelOpen, setThinkingPanelOpen] = useState(false);
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  const thinkingSelectorRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const workspaceResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const location = useLocation();
  const pendingUserMessageRef = useRef(getPendingUserMessage(location.state));
  const consumedPendingMessageIdRef = useRef<string | null>(null);

  const activeSessionId = sessionId && sessionId !== "new-session" ? sessionId : null;
  const models = flattenModels(modelProviders);
  const selectedModel = models.find(({ model }) => model.id === selectedModelId)?.model
    ?? models[0]?.model
    ?? activeSession?.model
    ?? null;
  const selectedModelName = selectedModel?.modelName ?? "选择模型";
  const selectedModelDisplayName = selectedModel ? getCompactModelName(selectedModel.modelName) : selectedModelName;
  const filteredProviderGroups = filterProviderGroups(modelProviders, modelSearch);
  const assistantName = activeSession?.character?.title ?? "智能助手";
  const assistantAvatarUrl = activeSession?.character?.avatarUrl ?? activeSession?.avatarUrl ?? null;
  const lastUserMessageId = [...messages].reverse().find((message) => message.role === "user")?.id ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      if (!activeSessionId) {
        setActiveSession(null);
        setLoadingSession(false);
        return;
      }

      setLoadingSession(true);
      try {
        const response = await api.client.fetchSession(activeSessionId);
        if (cancelled) return;

        setActiveSession(response);
        setSelectedModelId(response.modelId ?? response.model?.id ?? null);
      } catch (error) {
        setError(getErrorMessage(error, "会话加载失败"));
      } finally {
        if (!cancelled) {
          setLoadingSession(false);
        }
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [activeSessionId, api]);

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      try {
        const response = await api.client.fetchModels();
        if (!cancelled) {
          const providers = response.items ?? [];
          setModelProviders(providers);
          setSelectedModelId((current) => current ?? flattenModels(providers)[0]?.model.id ?? null);
        }
      } catch {
        if (!cancelled) {
          setModelProviders([]);
        }
      }
    }

    void loadModels();
    return () => {
      cancelled = true;
    };
  }, [api]);

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
    return () => document.removeEventListener("pointerdown", handlePointerDown);
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
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [thinkingPanelOpen]);

  useEffect(() => {
    if (messages.length === 0 || loadingMessages) return;
    messagesEndRef.current?.scrollIntoView?.({ block: "end", behavior: "smooth" });
  }, [messages, loadingMessages]);

  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    const sessionId = activeSessionId;

    async function loadMessages() {
      const pendingUserMessage = pendingUserMessageRef.current;
      if (pendingUserMessage) {
        setMessages([pendingUserMessage]);
        setLoadingMessages(false);
        return;
      }

      setLoadingMessages(true);
      try {
        const response: PaginatedResponse<Message> =
          await api.client.fetchSessionMessages(sessionId, { limit: 50 });
        if (!cancelled) {
          setMessages(response.items);
        }
      } catch (error) {
        setError(getErrorMessage(error, "消息加载失败"));
      } finally {
        if (!cancelled) {
          setLoadingMessages(false);
        }
      }
    }

    void loadMessages();
    return () => {
      cancelled = true;
    };
  }, [activeSessionId, api]);

  useEffect(() => {
    const pendingUserMessage = pendingUserMessageRef.current;
    if (!activeSessionId || !pendingUserMessage || streaming) return;
    if (consumedPendingMessageIdRef.current === pendingUserMessage.id) return;

    consumedPendingMessageIdRef.current = pendingUserMessage.id;
    setStreaming(true);
    setError(null);

    void (async () => {
      try {
        await streamAssistantResponse(pendingUserMessage, { appendUserMessage: false });
        clearPendingRouteState();
      } catch (error) {
        setError(getErrorMessage(error, "消息发送失败"));
      } finally {
        setStreaming(false);
      }
    })();
  }, [activeSessionId]);

  useEffect(() => {
    if (!activeSessionId) {
      setWorkspaceTree([]);
      setExpandedPaths(new Set());
      setWorkspaceError(null);
      setSelectedWorkspaceFile(null);
      return;
    }

    let cancelled = false;
    const sessionId = activeSessionId;

    async function loadWorkspaceTree() {
      setLoadingWorkspace(true);
      setWorkspaceError(null);
      try {
        const response = await api.client.fetchWorkspaceTree(sessionId);
        if (!cancelled) {
          setWorkspaceTree(response.tree);
          setExpandedPaths(new Set());
          setSelectedWorkspaceFile(null);
        }
      } catch (error) {
        if (!cancelled) {
          setWorkspaceError(getErrorMessage(error, "工作目录加载失败"));
          setWorkspaceTree([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingWorkspace(false);
        }
      }
    }

    void loadWorkspaceTree();
    return () => {
      cancelled = true;
    };
  }, [activeSessionId, api]);

  async function refreshWorkspaceTree() {
    if (!activeSessionId) return;

    setLoadingWorkspace(true);
    setWorkspaceError(null);
    try {
      const response = await api.client.fetchWorkspaceTree(activeSessionId);
      setWorkspaceTree(response.tree);
      setExpandedPaths(new Set());
    } catch (error) {
      setWorkspaceError(getErrorMessage(error, "工作目录加载失败"));
    } finally {
      setLoadingWorkspace(false);
    }
  }

  async function toggleWorkspaceDirectory(node: WorkspaceTreeNode) {
    if (!activeSessionId || !node.isDirectory) return;

    if (expandedPaths.has(node.path)) {
      setExpandedPaths((current) => {
        const next = new Set(current);
        next.delete(node.path);
        return next;
      });
      return;
    }

    setExpandedPaths((current) => new Set(current).add(node.path));

    if ((node.children?.length ?? 0) > 0 || node.hasChildren === false) return;

    setLoadingPath(node.path);
    setWorkspaceError(null);
    try {
      const response = await api.client.fetchWorkspaceChildren(activeSessionId, node.path);
      setWorkspaceTree((current) => updateWorkspaceNodeChildren(current, node.path, response.children));
    } catch (error) {
      setWorkspaceError(getErrorMessage(error, "目录加载失败"));
    } finally {
      setLoadingPath(null);
    }
  }

  async function selectWorkspaceFile(node: WorkspaceTreeNode) {
    if (!activeSessionId || node.isDirectory) return;

    if (!isPreviewableWorkspaceFile(node.name)) {
      setSelectedWorkspaceFile({
        node,
        file: null,
        loading: false,
        error: "此文件暂不支持预览",
      });
      return;
    }

    setSelectedWorkspaceFile({ node, file: null, loading: true, error: null });

    try {
      const file = await api.client.fetchWorkspaceFile(activeSessionId, node.path);
      setSelectedWorkspaceFile({ node, file, loading: false, error: null });
    } catch (error) {
      setSelectedWorkspaceFile({
        node,
        file: null,
        loading: false,
        error: getErrorMessage(error, "加载文件失败"),
      });
    }
  }

  function startWorkspaceResize(event: ReactPointerEvent<HTMLDivElement>) {
    workspaceResizeRef.current = {
      startX: event.clientX,
      startWidth: workspacePanelWidth,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);

    function handlePointerMove(pointerEvent: PointerEvent) {
      const resizeState = workspaceResizeRef.current;
      if (!resizeState) return;
      const nextWidth = clampWorkspacePanelWidth(resizeState.startWidth + resizeState.startX - pointerEvent.clientX);
      setWorkspacePanelWidth(nextWidth);
      localStorage.setItem(workspacePanelWidthStorageKey, String(nextWidth));
    }

    function stopResize() {
      workspaceResizeRef.current = null;
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", stopResize);
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", stopResize);
  }

  async function streamAssistantResponse(
    userMessage: Message,
    options: { appendUserMessage: boolean },
  ) {
    if (!activeSessionId) return;

    const userMessageContent = getMessageText(userMessage);
    if (!userMessageContent) {
      throw new Error("缺少消息内容");
    }

    await ensureSessionModel();

    const assistantMessage = createStreamingAssistantMessage();
    let streamMessageId = assistantMessage.id;
    let streamFinished = false;

    setMessages((current) =>
      options.appendUserMessage
        ? [...current, userMessage, assistantMessage]
        : [...current, assistantMessage],
    );

    try {
      for await (const event of api.chatStream.chat({
        sessionId: activeSessionId,
        userMessage: { content: userMessageContent },
      })) {
        if (event.type === "user_message") {
          setMessages((current) => replaceLocalUserMessage(current, userMessage.id, event.message));
        }
        if (event.type === "create") {
          setMessages((current) =>
            applyAssistantCreateEvent(current, assistantMessage.id, {
              messageId: event.messageId,
              contentId: event.contentId,
              turnsId: event.turnsId,
              modelName: event.modelName,
            }),
          );
          streamMessageId = event.messageId;
        }
        if (event.type === "think") {
          setMessages((current) => appendAssistantReasoning(current, streamMessageId, event.reasoningContent));
        }
        if (event.type === "text") {
          setMessages((current) => appendAssistantText(current, streamMessageId, event.content));
        }
        if (event.type === "tool_call") {
          setMessages((current) => appendAssistantToolCalls(current, streamMessageId, event.toolCalls));
        }
        if (event.type === "tool_calls_response") {
          setMessages((current) => appendAssistantToolResponses(current, streamMessageId, {
            toolCallsResponse: event.toolCallsResponse,
            displayMessages: "displayMessages" in event ? event.displayMessages : undefined,
            usage: event.usage,
          }));
        }
        if (event.type === "error") {
          streamFinished = true;
          setMessages((current) =>
            finishAssistantMessage(current, streamMessageId, {
              finishReason: "error",
              error: event.error,
            }),
          );
        }
        if (event.type === "finish") {
          streamFinished = true;
          setMessages((current) =>
            finishAssistantMessage(current, streamMessageId, {
              usage: event.usage,
              finishReason: event.finishReason,
              error: event.error,
            }),
          );
        }
      }
    } catch (streamError) {
      streamFinished = true;
      setMessages((current) =>
        finishAssistantMessage(current, streamMessageId, {
          finishReason: "error",
          error: getErrorMessage(streamError, "响应流读取失败"),
        }),
      );
      throw streamError;
    }

    if (!streamFinished) {
      setMessages((current) =>
        finishAssistantMessage(current, streamMessageId, {
          finishReason: "error",
          error: "响应流已结束，但未收到完成事件",
        }),
      );
    }
  }

  async function ensureSessionModel() {
    if (!activeSessionId || !selectedModel?.id) return;
    const currentModelId = activeSession?.modelId ?? activeSession?.model?.id ?? null;
    if (currentModelId === selectedModel.id) return;

    const updatedSession = await api.client.updateSession(activeSessionId, { modelId: selectedModel.id });
    setActiveSession((current) => ({
      ...(current ?? updatedSession),
      ...updatedSession,
      modelId: updatedSession.modelId ?? selectedModel.id,
      model: updatedSession.model ?? selectedModel,
    }));
    setSelectedModelId(selectedModel.id);
  }

  async function selectModel(model: Model) {
    setSelectedModelId(model.id);
    setModelPanelOpen(false);

    if (!activeSessionId) return;
    const currentModelId = activeSession?.modelId ?? activeSession?.model?.id ?? null;
    if (currentModelId === model.id) return;

    try {
      const updatedSession = await api.client.updateSession(activeSessionId, { modelId: model.id });
      setActiveSession((current) => ({
        ...(current ?? updatedSession),
        ...updatedSession,
        modelId: updatedSession.modelId ?? model.id,
        model: updatedSession.model ?? model,
      }));
    } catch (updateError) {
      setError(getErrorMessage(updateError, "模型切换失败"));
    }
  }

  async function sendMessage() {
    const content = draft.trim();
    if (!content || !activeSessionId || streaming) return;

    setDraft("");
    setStreaming(true);

    try {
      setError(null);
      const userMessage = createLocalUserMessage(content);
      await streamAssistantResponse(userMessage, { appendUserMessage: true });
    } catch (error) {
      setError(getErrorMessage(error, "消息发送失败"));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-screen min-w-0 overflow-hidden bg-white text-foreground dark:bg-[#1e1f23] dark:text-[#e8e9ed]">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center justify-between border-b border-slate-100 bg-white px-5 dark:border-[#2e3035] dark:bg-[#1e1f23]">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
              title={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
              className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30] dark:hover:text-[#e8e9ed]"
              onClick={toggleSidebar}
            >
              <PanelLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <h2 className="truncate text-sm font-semibold">
              {loadingSession ? "加载中..." : activeSession?.title ?? "聊天工作台"}
            </h2>
          </div>
        </header>

        {error ? (
          <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-[#1e1f23]">
          <div className="min-h-0 flex-1 overflow-auto px-6 py-8">
            {loadingMessages ? (
              <Spinner />
            ) : messages.length === 0 && !activeSessionId ? (
              <EmptyState description="选择会话后开始对话" className="min-h-64" />
            ) : (
              <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
                {messages.map((item) => (
                  <ChatMessageItem
                    key={item.id}
                    message={item}
                    assistantName={assistantName}
                    assistantAvatarUrl={assistantAvatarUrl}
                    onFetchToolDetails={(contentId) => api.client.fetchMessageContentToolDetails(contentId)}
                    onSwitchVersion={(messageId, contentId) => {
                      void switchMessageVersion(messageId, contentId);
                    }}
                    onRegenerate={(message) => {
                      void regenerateMessage(message);
                    }}
                    onGenerate={(message) => {
                      void generateResponseFromUserMessage(message);
                    }}
                    onEdit={(message) => {
                      openEditDialog(message);
                    }}
                    onDelete={(message) => {
                      setDeletingMessage(message);
                    }}
                    onContinue={(message) => {
                      void continueMessage(message);
                    }}
                    allowGenerate={!streaming && item.role === "user" && item.id === lastUserMessageId}
                  />
                ))}
                <div ref={messagesEndRef} aria-hidden="true" />
              </div>
            )}
          </div>

          <footer className="bg-white px-6 pb-6 pt-3 dark:bg-[#1e1f23]">
            <div className="mx-auto max-w-[760px] rounded-[22px] border border-slate-200 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.08)] dark:border-[#34363c] dark:bg-[#232428] dark:shadow-none">
              {composerEditingMessage ? (
                <div className="-mx-3 -mt-3 mb-3 flex items-center rounded-t-[22px] bg-slate-100 px-4 py-2 text-sm text-slate-600 dark:bg-[#2a2c30] dark:text-slate-300">
                  <span className="flex-1">正在编辑消息</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7"
                    onClick={() => {
                      setComposerEditingMessage(null);
                      setDraft("");
                    }}
                  >
                    取消编辑
                  </Button>
                </div>
              ) : null}
              <Textarea
                value={draft}
                disabled={!activeSessionId || streaming}
                placeholder="按 / 使用技能，Shift+Enter 换行"
                rows={2}
                className="min-h-14 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="relative" ref={thinkingSelectorRef}>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1 rounded px-1 py-1 text-sm transition-colors hover:text-foreground",
                        thinkingEffort !== "off" && "text-pink-500",
                      )}
                      onClick={() => setThinkingPanelOpen((open) => !open)}
                    >
                      <Lightbulb className="h-4 w-4" aria-hidden="true" />
                      {getThinkingEffortLabel(thinkingEffort)}
                    </button>
                    {thinkingPanelOpen ? (
                      <div className="absolute bottom-9 left-0 z-20 w-[180px] rounded-lg bg-white p-4 shadow-[0_12px_32px_rgba(0,0,0,0.15),0_4px_8px_rgba(0,0,0,0.1)] ring-1 ring-gray-200 dark:bg-[#232428] dark:ring-[#2e3035]">
                        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                          <Lightbulb className="h-4 w-4 text-slate-500" aria-hidden="true" />
                          思考强度
                        </div>
                        <div className="space-y-1">
                          {thinkingEffortOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className={cn(
                                "flex w-full items-center justify-between rounded px-2 py-1.5 text-sm transition-colors",
                                option.value === thinkingEffort ? "bg-pink-50" : "hover:bg-gray-50",
                              )}
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
                  <ComposerToolButton label="添加图片">
                    <FileImage className="h-5 w-5" aria-hidden="true" />
                  </ComposerToolButton>
                  <ComposerToolButton label="上传文件">
                    <Paperclip className="h-5 w-5" aria-hidden="true" />
                  </ComposerToolButton>
                  <ComposerToolButton label="知识库">
                    <Search className="h-5 w-5" aria-hidden="true" />
                  </ComposerToolButton>
                </div>
                <div className="relative flex items-center gap-3" ref={modelSelectorRef}>
                  <button
                    type="button"
                    className="inline-flex max-w-[220px] items-center gap-1.5 overflow-hidden rounded-full px-2 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#2a2c30]"
                    onClick={() => setModelPanelOpen((open) => !open)}
                  >
                    <ModelAvatar providerName={getProviderNameForModel(modelProviders, selectedModel)} />
                    <span className="truncate">{selectedModelDisplayName}</span>
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
                          className="h-8 w-full rounded border border-gray-200 bg-white pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-gray-300 dark:border-[#34363c] dark:bg-[#1e1f23]"
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
                                    className={cn(
                                      "flex w-full items-center gap-2 rounded p-2 text-left transition-colors",
                                      model.id === selectedModel?.id ? "bg-pink-50" : "hover:bg-gray-50",
                                    )}
                                    onClick={() => {
                                      void selectModel(model);
                                    }}
                                  >
                                    <ModelAvatar providerName={provider.name} className="h-8 w-8" />
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
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
                    <Settings className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <Button
                    type="button"
                    size="icon"
                    disabled={!activeSessionId || !draft.trim()}
                    className="h-9 w-9 rounded-full"
                    onClick={() => void sendMessage()}
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">发送</span>
                  </Button>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </section>

      {workspaceCollapsed ? null : <WorkspaceResizeHandle onPointerDown={startWorkspaceResize} />}
      <WorkspaceTreePanel
        collapsed={workspaceCollapsed}
        width={workspacePanelWidth}
        selectedFile={selectedWorkspaceFile}
        expandedPaths={expandedPaths}
        loading={loadingWorkspace}
        loadingPath={loadingPath}
        error={workspaceError}
        nodes={workspaceTree}
        onToggleCollapse={() => setWorkspaceCollapsed((current) => !current)}
        onRefresh={() => void refreshWorkspaceTree()}
        onToggleDirectory={(node) => void toggleWorkspaceDirectory(node)}
        onSelectFile={(node) => void selectWorkspaceFile(node)}
        onClosePreview={() => setSelectedWorkspaceFile(null)}
      />
      {editingMessage ? (
        <EditMessageDialog
          value={editDraft}
          onChange={setEditDraft}
          onCancel={() => setEditingMessage(null)}
          onSave={() => void saveEditedMessage()}
        />
      ) : null}
      {deletingMessage ? (
        <DeleteMessageDialog
          onCancel={() => setDeletingMessage(null)}
          onConfirm={() => void confirmDeleteMessage()}
        />
      ) : null}
    </div>
  );

  async function switchMessageVersion(messageId: string, contentId: string) {
    await api.client.updateMessageActiveContent(contentId, messageId);
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              currentTurnsId: message.contents.find((content) => content.id === contentId)?.turnsId ?? message.currentTurnsId,
            }
          : message,
      ),
    );
  }

  async function regenerateMessage(message: Message) {
    if (!activeSessionId) return;
    const parentId = message.parentId;
    setStreaming(true);
    try {
      for await (const event of api.chatStream.chat({
        sessionId: activeSessionId,
        assistantMessageId: message.id,
        regenerationMode: "multi_version",
        userMessage: parentId ? { id: parentId } : undefined,
      })) {
        setMessages((current) => applyStreamEvent(current, message.id, event));
      }
    } finally {
      setStreaming(false);
    }
  }

  async function generateResponseFromUserMessage(message: Message) {
    if (streaming) return;
    setComposerEditingMessage(message);
    setDraft(getMessageText(message));
  }

  async function continueMessage(message: Message) {
    if (!activeSessionId) return;
    setStreaming(true);
    try {
      for await (const event of api.chatStream.chat({
        sessionId: activeSessionId,
        assistantMessageId: message.id,
        regenerationMode: "resume",
        resumeData: { action: "continue" },
      })) {
        setMessages((current) => applyStreamEvent(current, message.id, event));
      }
    } finally {
      setStreaming(false);
    }
  }

  function openEditDialog(message: Message) {
    const currentContent = getEditableMessageContent(message);
    setEditingMessage(message);
    setEditDraft(currentContent?.content ?? "");
  }

  async function saveEditedMessage() {
    if (!editingMessage) return;

    const currentContent = getEditableMessageContent(editingMessage);
    if (editDraft === currentContent?.content) {
      setEditingMessage(null);
      return;
    }

    await api.client.updateMessage(editingMessage.id, { content: editDraft });
    setMessages((current) =>
      current.map((item) =>
        item.id === editingMessage.id
          ? {
              ...item,
              contents: item.contents.map((content) =>
                content.id === currentContent?.id ? { ...content, content: editDraft } : content,
              ),
            }
          : item,
      ),
    );
    setEditingMessage(null);
  }

  async function confirmDeleteMessage() {
    if (!deletingMessage) return;
    await deleteMessage(deletingMessage);
    setDeletingMessage(null);
  }

  async function deleteMessage(message: Message) {
    await api.client.deleteMessage(message.id);
    setMessages((current) => current.filter((item) => item.id !== message.id));
  }
}

function EditMessageDialog({
  value,
  onChange,
  onCancel,
  onSave,
}: {
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-100 grid place-items-center bg-black/35 px-4">
      <div
        role="dialog"
        aria-label="编辑内容"
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#34363c] dark:bg-[#232428]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">编辑内容</h2>
          <button
            type="button"
            aria-label="关闭编辑内容"
            className="rounded p-1 text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]"
            onClick={onCancel}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="edit-message-content">
          消息内容
        </label>
        <Textarea
          id="edit-message-content"
          value={value}
          rows={8}
          className="min-h-40 focus-visible:border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0"
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            取消
          </Button>
          <Button type="button" onClick={onSave}>
            保存
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DeleteMessageDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-100 grid place-items-center bg-white/75 px-4 backdrop-blur-sm dark:bg-black/55">
      <div
        role="dialog"
        aria-label="删除消息"
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#34363c] dark:bg-[#232428]"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">删除消息</h2>
          <button
            type="button"
            aria-label="关闭删除消息"
            className="rounded p-1 text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]"
            onClick={onCancel}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          确定要删除这条回答吗？此操作不可撤销。
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            取消
          </Button>
          <Button type="button" className="bg-red-500 text-white hover:bg-red-600" onClick={onConfirm}>
            确认
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function getEditableMessageContent(message: Message) {
  if (message.currentTurnsId) {
    const currentContent = message.contents.find(
      (content) => content.turnsId === message.currentTurnsId && typeof content.content === "string",
    );
    if (currentContent) return currentContent;
  }

  return message.contents.find((content) => typeof content.content === "string") ?? message.contents[0];
}

function getThinkingEffortLabel(effort: ThinkingEffort): string {
  return thinkingEffortOptions.find((option) => option.value === effort)?.label ?? "不思考";
}

function flattenModels(providers: ModelProvider[]): Array<{ provider: ModelProvider; model: Model }> {
  return providers.flatMap((provider) =>
    (provider.models ?? []).map((model) => ({
      provider,
      model,
    })),
  );
}

function filterProviderGroups(
  providers: ModelProvider[],
  search: string,
): Array<{ provider: ModelProvider; models: Model[] }> {
  const normalizedSearch = search.trim().toLowerCase();
  return providers
    .map((provider) => ({
      provider,
      models: (provider.models ?? []).filter((model) =>
        normalizedSearch
          ? `${provider.name} ${model.modelName}`.toLowerCase().includes(normalizedSearch)
          : true,
      ),
    }))
    .filter(({ models }) => models.length > 0);
}

function getProviderNameForModel(providers: ModelProvider[], model: Model | null): string | undefined {
  if (!model) return undefined;
  return providers.find((provider) => provider.id === model.providerId)?.name;
}

function getPendingUserMessage(state: unknown): Message | null {
  const pendingMessage = (state as ChatRouteState | null)?.pendingUserMessage;
  if (!pendingMessage || pendingMessage.role !== "user" || typeof pendingMessage.id !== "string") {
    return null;
  }

  return pendingMessage;
}

function clearPendingRouteState(): void {
  if (typeof window === "undefined") return;
  const currentState = window.history.state;
  if (!currentState || typeof currentState !== "object" || !("usr" in currentState)) return;

  window.history.replaceState({ ...currentState, usr: null }, "", window.location.href);
}

function getCompactModelName(modelName: string): string {
  const [, compactName] = modelName.match(/\/([^/]+)$/) ?? [];
  return compactName ?? modelName;
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
      <Bot className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
}

function ComposerToolButton({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        className="hover:text-foreground"
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        {children}
      </button>
      {visible ? (
        <span
          role="tooltip"
          aria-label={label}
          className="absolute bottom-7 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white shadow"
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}

function createStreamingAssistantMessage(): Message {
  const now = Date.now();
  return {
    id: `assistant-${now}`,
    role: "assistant",
    contents: [
      {
        id: `content-${now}`,
        content: "",
        reasoningContent: "",
        state: { isStreaming: true },
      },
    ],
    state: { isStreaming: true },
  };
}

function createLocalUserMessage(content: string): Message {
  const now = Date.now();
  return {
    id: `user-local-${now}`,
    role: "user",
    contents: [
      {
        id: `user-content-local-${now}`,
        content,
        state: { isStreaming: false },
      },
    ],
    state: { isStreaming: false },
  };
}

function getMessageText(message: Message): string {
  return message.contents
    .map((content) => content.content ?? "")
    .join("")
    .trim();
}

function replaceLocalUserMessage(messages: Message[], localMessageId: string, serverMessage: Message): Message[] {
  const hasLocalMessage = messages.some((message) => message.id === localMessageId);
  if (!hasLocalMessage) return messages;

  return messages.map((message) => (message.id === localMessageId ? serverMessage : message));
}

function applyStreamEvent(messages: Message[], messageId: string, event: StreamEvent): Message[] {
  if (event.type === "create") {
    return applyAssistantCreateEvent(messages, messageId, {
      messageId: event.messageId,
      contentId: event.contentId,
      turnsId: event.turnsId,
      modelName: event.modelName,
    });
  }
  if (event.type === "think") return appendAssistantReasoning(messages, messageId, event.reasoningContent);
  if (event.type === "text") return appendAssistantText(messages, messageId, event.content);
  if (event.type === "tool_call") return appendAssistantToolCalls(messages, messageId, event.toolCalls);
  if (event.type === "tool_calls_response") {
    return appendAssistantToolResponses(messages, messageId, {
      toolCallsResponse: event.toolCallsResponse,
      displayMessages: "displayMessages" in event ? event.displayMessages : undefined,
      usage: event.usage,
    });
  }
  if (event.type === "error") {
    return finishAssistantMessage(messages, messageId, {
      finishReason: "error",
      error: event.error,
    });
  }
  if (event.type === "finish") {
    return finishAssistantMessage(messages, messageId, {
      usage: event.usage,
      finishReason: event.finishReason,
      error: event.error,
    });
  }
  return messages;
}

function applyAssistantCreateEvent(
  messages: Message[],
  localMessageId: string,
  event: { messageId: string; contentId: string; turnsId: string; modelName: string },
): Message[] {
  return messages.map((item) => {
    if (item.id !== localMessageId && item.id !== event.messageId) return item;

    return {
      ...item,
      id: event.messageId,
      currentTurnsId: event.turnsId,
      contents: item.contents.map((content, index) =>
        index === 0
          ? {
              ...content,
              id: event.contentId,
              turnsId: event.turnsId,
              metadata: { ...content.metadata, modelName: event.modelName },
            }
          : content,
      ),
    };
  });
}

function appendAssistantText(messages: Message[], messageId: string, content: string): Message[] {
  return messages.map((item) => {
    if (item.id !== messageId) return item;

    const lastContent = item.contents.at(-1);
    if (lastContent && hasToolMetadata(lastContent)) {
      return {
        ...item,
        contents: [
          ...item.contents,
          {
            ...createSiblingContent(lastContent, "text"),
            content,
          },
        ],
      };
    }

    const targetIndex = Math.max(item.contents.length - 1, 0);
    return {
      ...item,
      contents: item.contents.map((messageContent, index) =>
        index === targetIndex
          ? {
              ...messageContent,
              content: `${messageContent.content ?? ""}${content}`,
            }
          : messageContent,
      ),
    };
  });
}

function appendAssistantToolCalls(messages: Message[], messageId: string, toolCalls: unknown[]): Message[] {
  if (toolCalls.length === 0) return messages;

  return messages.map((item) => {
    if (item.id !== messageId) return item;

    const lastContent = item.contents.at(-1);
    if (!lastContent) return item;
    const detailContentId = getDetailContentId(lastContent);
    const toolCallsWithDetailContentId = withToolDetailContentId(toolCalls, detailContentId);
    const nextToolContent = {
      ...createSiblingContent(lastContent, "tool"),
      metadata: { ...lastContent.metadata, detailContentId, toolCalls: toolCallsWithDetailContentId },
    };

    if (hasToolMetadata(lastContent)) {
      return {
        ...item,
        contents: item.contents.map((messageContent, index) =>
          index === item.contents.length - 1
            ? {
                ...messageContent,
                metadata: {
                  ...messageContent.metadata,
                  toolCalls: mergeToolCalls(messageContent.metadata?.toolCalls, toolCallsWithDetailContentId),
                },
              }
            : messageContent,
        ),
      };
    }

    if (isEmptyProcessContent(lastContent)) {
      return {
        ...item,
        contents: item.contents.map((messageContent, index) =>
          index === item.contents.length - 1 ? nextToolContent : messageContent,
        ),
      };
    }

    return {
      ...item,
      contents: [...item.contents, nextToolContent],
    };
  });
}

function withToolDetailContentId(toolCalls: unknown[], detailContentId: string): unknown[] {
  return toolCalls.map((toolCall) => {
    const record = asRecord(toolCall);
    if (!record) return toolCall;
    return {
      ...record,
      metadata: {
        ...(asRecord(record.metadata) ?? {}),
        detailContentId,
      },
    };
  });
}

function mergeToolCalls(current: unknown, incoming: unknown[]): unknown[] {
  const merged = Array.isArray(current) ? current.map((item) => cloneToolCall(item)) : [];

  for (const next of incoming) {
    const nextRecord = asRecord(next);
    const matchIndex = nextRecord ? findMatchingToolCallIndex(merged, nextRecord) : -1;

    if (matchIndex === -1) {
      merged.push(cloneToolCall(next));
    } else {
      merged[matchIndex] = mergeToolCall(merged[matchIndex], next);
    }
  }

  return merged;
}

function findMatchingToolCallIndex(items: unknown[], next: Record<string, unknown>): number {
  return items.findIndex((item) => {
    const current = asRecord(item);
    if (!current) return false;
    return (
      hasSameToolIdentity(current, next, "index") ||
      hasSameToolIdentity(current, next, "id") ||
      hasSameToolIdentity(current, next, "toolCallId")
    );
  });
}

function hasSameToolIdentity(
  current: Record<string, unknown>,
  next: Record<string, unknown>,
  key: string,
): boolean {
  return current[key] !== undefined && next[key] !== undefined && current[key] === next[key];
}

function mergeToolCall(current: unknown, incoming: unknown): unknown {
  const currentRecord = asRecord(current);
  const incomingRecord = asRecord(incoming);
  if (!currentRecord || !incomingRecord) return cloneToolCall(incoming);

  return removeUndefined({
    ...currentRecord,
    ...incomingRecord,
    name: getNonEmptyValue(incomingRecord.name) ?? currentRecord.name,
    arguments: mergeToolArguments(currentRecord.arguments, incomingRecord.arguments),
    metadata: mergeToolMetadata(currentRecord.metadata, incomingRecord.metadata),
  });
}

function mergeToolArguments(current: unknown, incoming: unknown): unknown {
  if (typeof current === "string" && typeof incoming === "string") return `${current}${incoming}`;
  return incoming ?? current;
}

function mergeToolMetadata(current: unknown, incoming: unknown): unknown {
  const currentRecord = asRecord(current);
  const incomingRecord = asRecord(incoming);
  if (!currentRecord && !incomingRecord) return undefined;
  return {
    ...(currentRecord ?? {}),
    ...(incomingRecord ?? {}),
    displayMessage: getUsefulDisplayMessage(incomingRecord?.displayMessage) ?? currentRecord?.displayMessage,
  };
}

function getNonEmptyValue(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function getUsefulDisplayMessage(value: unknown): unknown {
  if (typeof value === "string") return value.trim() ? value : undefined;

  const display = asRecord(value);
  if (!display) return value;

  const action = typeof display.action === "string" ? display.action.trim() : "";
  const args = typeof display.args === "string" ? display.args.trim() : "";
  return action || args ? value : undefined;
}

function cloneToolCall(value: unknown): unknown {
  const record = asRecord(value);
  return record ? { ...record, metadata: cloneRecord(record.metadata) } : value;
}

function cloneRecord(value: unknown): Record<string, unknown> | undefined {
  const record = asRecord(value);
  return record ? { ...record } : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function appendAssistantToolResponses(
  messages: Message[],
  messageId: string,
  metadata: Record<string, unknown>,
): Message[] {
  return messages.map((item) => {
    if (item.id !== messageId) return item;

    const toolContentIndex = findLastIndex(item.contents, hasToolMetadata);
    if (toolContentIndex === -1) return updateAssistantMetadata([item], messageId, metadata)[0] ?? item;

    return {
      ...item,
      contents: item.contents.map((messageContent, index) =>
        index === toolContentIndex
          ? {
              ...messageContent,
              metadata: { ...messageContent.metadata, ...removeUndefined(metadata) },
            }
          : messageContent,
      ),
    };
  });
}

function appendAssistantReasoning(messages: Message[], messageId: string, content: string): Message[] {
  return messages.map((item) => {
    if (item.id !== messageId) return item;

    const [firstContent, ...rest] = item.contents;
    return {
      ...item,
      contents: [
        {
          ...firstContent,
          reasoningContent: `${firstContent?.reasoningContent ?? ""}${content}`,
          state: { ...firstContent?.state, isThinking: true, isStreaming: true },
        },
        ...rest,
      ],
      state: { ...item.state, isThinking: true, isStreaming: true },
    };
  });
}

function createSiblingContent(content: Message["contents"][number], purpose: string): Message["contents"][number] {
  const detailContentId = getDetailContentId(content);
  return {
    id: `${content.id}-${purpose}`,
    turnsId: content.turnsId,
    content: "",
    reasoningContent: "",
    metadata: { modelName: content.metadata?.modelName, detailContentId },
    state: { ...content.state, isStreaming: true },
  };
}

function getDetailContentId(content: Message["contents"][number]): string {
  const detailContentId = content.metadata?.detailContentId;
  return typeof detailContentId === "string" && detailContentId ? detailContentId : content.id;
}

function hasToolMetadata(content: Message["contents"][number]): boolean {
  const metadata = content.metadata ?? {};
  return Array.isArray(metadata.toolCalls) && metadata.toolCalls.length > 0;
}

function isEmptyProcessContent(content: Message["contents"][number]): boolean {
  return !content.content?.trim() && !content.reasoningContent?.trim() && !hasToolMetadata(content);
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index]!)) return index;
  }
  return -1;
}

function updateAssistantMetadata(
  messages: Message[],
  messageId: string,
  metadata: Record<string, unknown>,
): Message[] {
  return messages.map((item) => {
    if (item.id !== messageId) return item;

    const [firstContent, ...rest] = item.contents;
    return {
      ...item,
      contents: [
        {
          ...firstContent,
          metadata: { ...firstContent?.metadata, ...removeUndefined(metadata) },
        },
        ...rest,
      ],
    };
  });
}

function finishAssistantMessage(
  messages: Message[],
  messageId: string,
  metadata: Record<string, unknown> = {},
): Message[] {
  return messages.map((item) =>
    item.id === messageId
      ? {
          ...item,
          state: { ...item.state, isStreaming: false, isThinking: false },
          contents: item.contents.map((content) => ({
            ...content,
            metadata: { ...content.metadata, ...removeUndefined(metadata) },
            state: { ...content.state, isStreaming: false, isThinking: false },
          })),
        }
      : item,
  );
}

function removeUndefined(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function isPreviewableWorkspaceFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return [
    ".txt",
    ".md",
    ".markdown",
    ".json",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".css",
    ".html",
    ".yml",
    ".yaml",
    ".xml",
    ".csv",
    ".log",
  ].some((extension) => lowerName.endsWith(extension));
}

function isMarkdownWorkspaceFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return lowerName.endsWith(".md") || lowerName.endsWith(".markdown");
}

function getStoredWorkspacePanelWidth(): number {
  if (typeof localStorage === "undefined") return defaultWorkspacePanelWidth;
  const storedWidth = localStorage.getItem(workspacePanelWidthStorageKey);
  if (!storedWidth) return defaultWorkspacePanelWidth;
  const value = Number(storedWidth);
  return Number.isFinite(value) ? clampWorkspacePanelWidth(value) : defaultWorkspacePanelWidth;
}

function clampWorkspacePanelWidth(width: number): number {
  return Math.min(maxWorkspacePanelWidth, Math.max(minWorkspacePanelWidth, Math.round(width)));
}

function updateWorkspaceNodeChildren(
  nodes: WorkspaceTreeNode[],
  path: string,
  children: WorkspaceTreeNode[],
): WorkspaceTreeNode[] {
  return nodes.map((node) => {
    if (node.path === path) {
      return { ...node, children, hasChildren: children.length > 0 };
    }

    if (!node.children) return node;

    return {
      ...node,
      children: updateWorkspaceNodeChildren(node.children, path, children),
    };
  });
}

function WorkspaceResizeHandle({
  onPointerDown,
}: {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      role="separator"
      aria-label="调整工作目录宽度"
      aria-orientation="vertical"
      className="hidden w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-slate-200 dark:hover:bg-[#34363c] lg:block"
      onPointerDown={onPointerDown}
    />
  );
}

interface WorkspaceTreePanelProps {
  collapsed: boolean;
  width: number;
  selectedFile: SelectedWorkspaceFile | null;
  expandedPaths: Set<string>;
  loading: boolean;
  loadingPath: string | null;
  error: string | null;
  nodes: WorkspaceTreeNode[];
  onToggleCollapse: () => void;
  onRefresh: () => void;
  onToggleDirectory: (node: WorkspaceTreeNode) => void;
  onSelectFile: (node: WorkspaceTreeNode) => void;
  onClosePreview: () => void;
}

function WorkspaceTreePanel({
  collapsed,
  width,
  selectedFile,
  expandedPaths,
  loading,
  loadingPath,
  error,
  nodes,
  onToggleCollapse,
  onRefresh,
  onToggleDirectory,
  onSelectFile,
  onClosePreview,
}: WorkspaceTreePanelProps) {
  if (collapsed) {
    return (
      <div className="hidden w-12 shrink-0 border-l border-slate-100 bg-white dark:border-[#2e3035] dark:bg-[#1e1f23] lg:flex lg:flex-col lg:items-center lg:py-3">
        <button
          type="button"
          aria-label="展开工作目录"
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]"
          onClick={onToggleCollapse}
        >
          <Folder className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (selectedFile) {
    return <WorkspaceFilePreview selectedFile={selectedFile} width={width} onClose={onClosePreview} />;
  }

  return (
    <div
      data-testid="workspace-panel"
      className="hidden shrink-0 flex-col border-l border-slate-100 bg-[#fcfcfd] dark:border-[#2e3035] dark:bg-[#202126] lg:flex"
      style={{ width }}
    >
      <header className="flex h-12 items-center justify-between border-b border-slate-100 px-4 dark:border-[#2e3035]">
        <h2 className="text-sm font-semibold">工作目录</h2>
        <div className="flex items-center gap-1 text-muted-foreground">
          <button
            type="button"
            aria-label="刷新工作目录"
            className="rounded p-1 transition-colors hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]"
            onClick={onRefresh}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="收起工作目录"
            className="rounded p-1 transition-colors hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]"
            onClick={onToggleCollapse}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
        {loading && nodes.length === 0 ? (
          <div className="py-8">
            <Spinner />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p>{error}</p>
            <button
              type="button"
              className="mt-2 rounded-md px-2 py-1 text-xs font-medium hover:bg-red-100"
              onClick={onRefresh}
            >
              重试
            </button>
          </div>
        ) : nodes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-muted-foreground">
            暂无工作目录文件
          </p>
        ) : (
          <div className="space-y-0.5">
            {nodes.map((node) => (
              <WorkspaceTreeRow
                key={node.path}
                node={node}
                depth={0}
                expandedPaths={expandedPaths}
                loadingPath={loadingPath}
                onToggleDirectory={onToggleDirectory}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WorkspaceFilePreview({
  selectedFile,
  width,
  onClose,
}: {
  selectedFile: SelectedWorkspaceFile;
  width: number;
  onClose: () => void;
}) {
  const [previewMode, setPreviewMode] = useState<"preview" | "source">("preview");
  const isMarkdownFile = isMarkdownWorkspaceFile(selectedFile.node.name);
  const fileContent = selectedFile.file?.content ?? "";

  return (
    <div
      data-testid="workspace-panel"
      className="hidden shrink-0 flex-col border-l border-slate-100 bg-[#fcfcfd] dark:border-[#2e3035] dark:bg-[#202126] lg:flex"
      style={{ width }}
    >
      <header className="flex h-12 items-center justify-between border-b border-slate-100 px-4 dark:border-[#2e3035]">
        <h2 className="truncate text-sm font-semibold">{selectedFile.node.name}</h2>
        <div className="flex items-center gap-2">
          {isMarkdownFile ? (
            <div className="flex overflow-hidden rounded-md border border-slate-200 text-xs dark:border-[#34363c]">
              <button
                type="button"
                aria-pressed={previewMode === "preview"}
                className={cn(
                  "px-2 py-1 transition-colors",
                  previewMode === "preview"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]",
                )}
                onClick={() => setPreviewMode("preview")}
              >
                预览
              </button>
              <button
                type="button"
                aria-pressed={previewMode === "source"}
                className={cn(
                  "border-l border-slate-200 px-2 py-1 transition-colors dark:border-[#34363c]",
                  previewMode === "source"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]",
                )}
                onClick={() => setPreviewMode("source")}
              >
                源码
              </button>
            </div>
          ) : null}
          <button
            type="button"
            aria-label="关闭文件预览"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {selectedFile.loading ? (
          <div className="grid h-full min-h-40 place-items-center">
            <Spinner />
          </div>
        ) : selectedFile.error ? (
          <div className="grid h-full min-h-40 place-items-center text-center text-sm text-muted-foreground">
            {selectedFile.error}
          </div>
        ) : isMarkdownFile && previewMode === "preview" ? (
          <MarkdownContent content={fileContent} className="rounded-lg bg-white p-3 dark:bg-[#1e1f23]" />
        ) : (
          <SourceCodePreview fileName={selectedFile.node.name} content={fileContent} />
        )}
      </div>
    </div>
  );
}

function SourceCodePreview({ fileName, content }: { fileName: string; content: string }) {
  const html = highlightCode(content, getLanguageFromFileName(fileName));

  return (
    <div
      className="workspace-code-preview rounded-lg p-3 text-xs leading-5"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

interface WorkspaceTreeRowProps {
  node: WorkspaceTreeNode;
  depth: number;
  expandedPaths: Set<string>;
  loadingPath: string | null;
  onToggleDirectory: (node: WorkspaceTreeNode) => void;
  onSelectFile: (node: WorkspaceTreeNode) => void;
}

function WorkspaceTreeRow({
  node,
  depth,
  expandedPaths,
  loadingPath,
  onToggleDirectory,
  onSelectFile,
}: WorkspaceTreeRowProps) {
  const expanded = expandedPaths.has(node.path);
  const loading = loadingPath === node.path;

  return (
    <div>
      <button
        type="button"
        aria-label={node.isDirectory ? `${expanded ? "收起" : "展开"} ${node.name}` : `文件 ${node.name}`}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-foreground dark:text-[#d6d7dc] dark:hover:bg-[#2a2c30]"
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => {
          if (node.isDirectory) {
            onToggleDirectory(node);
          } else {
            onSelectFile(node);
          }
        }}
      >
        {node.isDirectory ? (
          expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          )
        ) : (
          <span className="w-3.5 shrink-0" aria-hidden="true" />
        )}
        {node.isDirectory ? (
          <Folder className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
        ) : (
          <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        {loading ? (
          <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" aria-hidden="true" />
        ) : null}
      </button>
      {expanded && node.children?.length ? (
        <div>
          {node.children.map((child) => (
            <WorkspaceTreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              loadingPath={loadingPath}
              onToggleDirectory={onToggleDirectory}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default ChatWorkspace;
