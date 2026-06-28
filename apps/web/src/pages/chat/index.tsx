import { useEffect, useState } from "react";
import { PanelLeft, Send } from "lucide-react";
import { useParams } from "react-router-dom";
import { mosaicApi, type ApiClient, type ChatStreamService } from "@mosaic-dock/api-client";
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
    "fetchSession" | "fetchSessionMessages" | "createMessage"
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
    <div className="flex h-screen min-w-0 flex-col bg-background dark:bg-[#1e1f23]">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-background px-4 dark:border-[#2e3035] dark:bg-[#1e1f23]">
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

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto px-6 py-8">
          {loadingMessages ? (
            <Spinner />
          ) : messages.length === 0 ? (
            <EmptyState description="选择会话后开始对话" className="min-h-64" />
          ) : (
            messages.map((item) => (
              <article
                key={item.id}
                className={cn(
                  "mx-auto flex w-full max-w-[760px] gap-3",
                  item.role === "user" && "ml-auto flex-row-reverse",
                )}
              >
                <div
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-950 text-xs font-medium text-white",
                    item.role === "user" && "bg-primary",
                  )}
                >
                  {item.role === "user" ? "我" : "助手"}
                </div>
                <div
                  className={cn(
                    "min-w-[120px] whitespace-pre-wrap rounded-2xl bg-transparent px-4 py-3 leading-7",
                    item.role === "assistant" && "border border-slate-200 bg-white shadow-sm dark:border-[#34363c] dark:bg-[#232428]",
                    item.role === "user" && "max-w-[70%] bg-primary text-primary-foreground shadow-sm",
                  )}
                >
                  {messageText(item)}
                </div>
              </article>
            ))
          )}
        </div>

        <footer className="bg-background px-6 pb-6 pt-3 dark:bg-[#1e1f23]">
          <div className="mx-auto flex max-w-[760px] items-end gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-[#34363c] dark:bg-[#232428]">
            <Textarea
              value={draft}
              disabled={!activeSessionId || streaming}
              placeholder="输入消息，按 Enter 发送"
              rows={2}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
            />
            <Button
              type="button"
              disabled={!activeSessionId || !draft.trim()}
              className="h-10 rounded-xl px-4"
              onClick={() => void sendMessage()}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              发送
            </Button>
          </div>
        </footer>
      </section>
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

export default ChatWorkspace;
