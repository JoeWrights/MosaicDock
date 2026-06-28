import { useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { mosaicApi, type ApiClient, type ChatStreamService } from "@mosaic-dock/api-client";
import type { Message, PaginatedResponse, Session, SessionListResponse } from "@mosaic-dock/shared";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { Spinner } from "../../components/ui/spinner";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../lib/utils";

export interface ChatWorkspaceApi {
  client: Pick<
    ApiClient,
    "fetchSessions" | "fetchSessionMessages" | "createMessage"
  >;
  chatStream: Pick<ChatStreamService, "chat" | "cancelResponse">;
}

interface ChatWorkspaceProps {
  api?: ChatWorkspaceApi;
}

export function ChatWorkspace({ api = mosaicApi }: ChatWorkspaceProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSessions() {
      setLoadingSessions(true);
      try {
        const response: SessionListResponse = await api.client.fetchSessions({
          limit: 50,
        });
        if (cancelled) return;

        setSessions(response.items);
        setActiveSessionId((current) => current ?? response.items[0]?.id ?? null);
      } catch (error) {
        setError(getErrorMessage(error, "会话加载失败"));
      } finally {
        if (!cancelled) {
          setLoadingSessions(false);
        }
      }
    }

    void loadSessions();
    return () => {
      cancelled = true;
    };
  }, [api]);

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
    <div className="grid h-[calc(100vh-4rem)] grid-cols-1 bg-background md:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="min-h-0 border-r bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">会话</h2>
        {loadingSessions ? (
          <Spinner />
        ) : (
          <div className="space-y-2">
            {sessions.length === 0 ? (
              <EmptyState description="暂无会话" />
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className={cn(
                    "w-full rounded-xl px-3 py-3 text-left text-sm transition-colors hover:bg-accent",
                    session.id === activeSessionId && "bg-primary/10 font-semibold text-primary",
                  )}
                  onClick={() => setActiveSessionId(session.id)}
                >
                  {session.title || "未命名会话"}
                </button>
              ))
            )}
          </div>
        )}
      </aside>
      <section className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between border-b bg-card px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold">{activeSession?.title ?? "聊天工作台"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              第一阶段连接现有 guada 后端，保持 /api/v1 协议。
            </p>
          </div>
        </header>

        {error ? (
          <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-6">
          {loadingMessages ? (
            <Spinner />
          ) : messages.length === 0 ? (
            <EmptyState description="选择会话后开始对话" className="min-h-64" />
          ) : (
            messages.map((item) => (
              <article
                key={item.id}
                className={cn(
                  "flex max-w-3xl gap-3",
                  item.role === "user" && "ml-auto flex-row-reverse",
                )}
              >
                <div
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-950 text-xs font-medium text-white",
                    item.role === "user" && "bg-primary",
                  )}
                >
                  {item.role === "user" ? "我" : "助手"}
                </div>
                <div
                  className={cn(
                    "min-w-[120px] whitespace-pre-wrap rounded-2xl border bg-card px-4 py-3 leading-7 shadow-sm",
                    item.role === "user" && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {messageText(item)}
                </div>
              </article>
            ))
          )}
        </div>

        <footer className="flex items-end gap-3 border-t bg-card px-6 py-5">
          <Textarea
            value={draft}
            disabled={!activeSessionId || streaming}
            placeholder="输入消息，按 Enter 发送"
            rows={2}
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
            onClick={() => void sendMessage()}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            发送
          </Button>
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
