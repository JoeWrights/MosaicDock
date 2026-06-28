import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, PanelLeft, RefreshCw, Send, X } from "lucide-react";
import { useParams } from "react-router-dom";
import {
  mosaicApi,
  type ApiClient,
  type ChatStreamService,
  type WorkspaceTreeNode,
} from "@mosaic-dock/api-client";
import type { Message, PaginatedResponse, Session } from "@mosaic-dock/shared";
import { Button } from "../../components/ui/button";
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
    | "createMessage"
    | "fetchWorkspaceTree"
    | "fetchWorkspaceChildren"
  >;
  chatStream: Pick<ChatStreamService, "chat" | "cancelResponse">;
}

interface ChatWorkspaceProps {
  api?: ChatWorkspaceApi;
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
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false);

  const activeSessionId = sessionId && sessionId !== "new-session" ? sessionId : null;

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
    if (!activeSessionId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    const sessionId = activeSessionId;

    async function loadMessages() {
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
    if (!activeSessionId) {
      setWorkspaceTree([]);
      setExpandedPaths(new Set());
      setWorkspaceError(null);
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

  async function sendMessage() {
    const content = draft.trim();
    if (!content || !activeSessionId || streaming) return;

    setDraft("");
    setStreaming(true);

    try {
      setError(null);
      const userMessage = await api.client.createMessage(activeSessionId, content);
      const assistantMessage = createStreamingAssistantMessage();

      setMessages((current) => [...current, userMessage, assistantMessage]);

      for await (const event of api.chatStream.chat({
        sessionId: activeSessionId,
        userMessage: { id: userMessage.id },
      })) {
        if (event.type === "text") {
          setMessages((current) => appendAssistantText(current, assistantMessage.id, event.content));
        }
        if (event.type === "finish") {
          setMessages((current) => finishAssistantMessage(current, assistantMessage.id));
        }
      }
    } catch (error) {
      setError(getErrorMessage(error, "消息发送失败"));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-screen min-w-0 bg-white text-foreground dark:bg-[#1e1f23] dark:text-[#e8e9ed]">
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
            ) : messages.length === 0 ? (
              <EmptyState description="选择会话后开始对话" className="min-h-64" />
            ) : (
              <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
                {messages.map((item) => (
                  <article
                    key={item.id}
                    className={cn(
                      "flex w-full gap-3",
                      item.role === "user" && "justify-end",
                    )}
                  >
                    {item.role === "assistant" ? (
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-950 text-xs font-medium text-white">
                        助手
                      </div>
                    ) : null}
                    <div
                      className={cn(
                        "min-w-[120px] whitespace-pre-wrap rounded-2xl px-4 py-3 leading-7",
                        item.role === "assistant" &&
                          "border border-slate-200 bg-white shadow-sm dark:border-[#34363c] dark:bg-[#232428]",
                        item.role === "user" &&
                          "max-w-[70%] bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-500/15 dark:text-blue-100",
                      )}
                    >
                      {messageText(item)}
                    </div>
                    {item.role === "user" ? (
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-medium text-white">
                        我
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>

          <footer className="bg-white px-6 pb-6 pt-3 dark:bg-[#1e1f23]">
            <div className="mx-auto max-w-[760px] rounded-[22px] border border-slate-200 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.08)] dark:border-[#34363c] dark:bg-[#232428] dark:shadow-none">
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
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>不思考</span>
                  <span>图片</span>
                  <span>附件</span>
                  <span>搜索</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="max-w-[180px] truncate text-xs font-semibold text-slate-500">
                    {activeSession?.model?.modelName ?? "选择模型"}
                  </span>
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

      <WorkspaceTreePanel
        collapsed={workspaceCollapsed}
        expandedPaths={expandedPaths}
        loading={loadingWorkspace}
        loadingPath={loadingPath}
        error={workspaceError}
        nodes={workspaceTree}
        onToggleCollapse={() => setWorkspaceCollapsed((current) => !current)}
        onRefresh={() => void refreshWorkspaceTree()}
        onToggleDirectory={(node) => void toggleWorkspaceDirectory(node)}
      />
    </div>
  );
}

function messageText(item: Message): string {
  return item.contents.map((content) => content.content ?? "").join("");
}

function createStreamingAssistantMessage(): Message {
  return {
    id: `assistant-${Date.now()}`,
    role: "assistant",
    contents: [
      {
        id: `content-${Date.now()}`,
        content: "",
        state: { isStreaming: true },
      },
    ],
    state: { isStreaming: true },
  };
}

function appendAssistantText(messages: Message[], messageId: string, content: string): Message[] {
  return messages.map((item) => {
    if (item.id !== messageId) return item;

    const [firstContent, ...rest] = item.contents;
    return {
      ...item,
      contents: [
        {
          ...firstContent,
          content: `${firstContent?.content ?? ""}${content}`,
        },
        ...rest,
      ],
    };
  });
}

function finishAssistantMessage(messages: Message[], messageId: string): Message[] {
  return messages.map((item) =>
    item.id === messageId
      ? {
          ...item,
          state: { ...item.state, isStreaming: false },
          contents: item.contents.map((content) => ({
            ...content,
            state: { ...content.state, isStreaming: false },
          })),
        }
      : item,
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
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

interface WorkspaceTreePanelProps {
  collapsed: boolean;
  expandedPaths: Set<string>;
  loading: boolean;
  loadingPath: string | null;
  error: string | null;
  nodes: WorkspaceTreeNode[];
  onToggleCollapse: () => void;
  onRefresh: () => void;
  onToggleDirectory: (node: WorkspaceTreeNode) => void;
}

function WorkspaceTreePanel({
  collapsed,
  expandedPaths,
  loading,
  loadingPath,
  error,
  nodes,
  onToggleCollapse,
  onRefresh,
  onToggleDirectory,
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

  return (
    <div className="hidden w-[280px] shrink-0 flex-col border-l border-slate-100 bg-[#fcfcfd] dark:border-[#2e3035] dark:bg-[#202126] lg:flex">
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface WorkspaceTreeRowProps {
  node: WorkspaceTreeNode;
  depth: number;
  expandedPaths: Set<string>;
  loadingPath: string | null;
  onToggleDirectory: (node: WorkspaceTreeNode) => void;
}

function WorkspaceTreeRow({
  node,
  depth,
  expandedPaths,
  loadingPath,
  onToggleDirectory,
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
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default ChatWorkspace;
