import { getClientId } from "@mosaic-dock/shared";
import type { Message } from "@mosaic-dock/shared";

export type StreamEvent =
  | { type: "user_message"; message: Message }
  | { type: "create"; messageId: string; turnsId: string; contentId: string; modelName: string }
  | { type: "think"; reasoningContent: string }
  | { type: "text"; content: string }
  | { type: "tool_call"; toolCalls: unknown[] }
  | { type: "tool_calls_response"; toolCallsResponse: unknown[]; usage?: TokenUsage }
  | { type: "compression_start"; content: string }
  | { type: "compression_error"; content: string }
  | { type: "sub_agent_start"; subSessionId: string; name: string }
  | { type: "sub_agent_finish"; subSessionId: string; status: "completed" | "error"; result?: string; error?: string }
  | { type: "error"; error: string }
  | { type: "finish"; usage?: TokenUsage; finishReason: string; error?: string };

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  promptCacheHitTokens?: number;
  promptCacheMissTokens?: number;
}

export interface ChatStreamParams {
  sessionId: string;
  regenerationMode?: string | null;
  assistantMessageId?: string | null;
  resumeData?: unknown;
  lastContentId?: string | null;
  userMessage?: {
    id?: string;
    content?: string;
    files?: string[];
    replaceMessageId?: string;
    knowledgeBaseIds?: string[];
  };
}

export interface ParsedSseChunk {
  events: StreamEvent[];
  buffer: string;
  done: boolean;
}

export function parseSseChunk(chunk: string, previousBuffer: string): ParsedSseChunk {
  let buffer = `${previousBuffer}${chunk}`;
  const events: StreamEvent[] = [];
  let done = false;
  let boundary = buffer.indexOf("\n");

  while (boundary !== -1) {
    const line = buffer.slice(0, boundary).trim();
    buffer = buffer.slice(boundary + 1);

    if (line === "data: [DONE]") {
      done = true;
      buffer = "";
      break;
    }

    if (line.startsWith("data: ")) {
      events.push(JSON.parse(line.slice(6)) as StreamEvent);
    }

    boundary = buffer.indexOf("\n");
  }

  return { events, buffer, done };
}

export class ChatStreamService {
  private readonly abortControllerMap = new Map<string, AbortController>();

  constructor(
    private readonly getBaseURL: () => string,
    private readonly tokenProvider: () => string | null = defaultTokenProvider,
    private readonly clientIdProvider: () => string = getClientId,
    private readonly fetcher: typeof fetch = fetch.bind(globalThis),
  ) {}

  async *chat(params: ChatStreamParams): AsyncGenerator<StreamEvent, void, unknown> {
    const { sessionId } = params;
    const isSubscribeMode = params.regenerationMode === "subscribe";

    if (!isSubscribeMode) {
      this.cancelLocalFetch(sessionId);
    }

    const controller = new AbortController();
    this.abortControllerMap.set(sessionId, controller);

    try {
      const response = await this.fetcher(`${this.getBaseURL()}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.tokenProvider() ?? ""}`,
          "X-Client-Id": this.clientIdProvider(),
        },
        body: JSON.stringify({
          sessionId,
          assistantMessageId: params.assistantMessageId ?? null,
          regenerationMode: params.regenerationMode ?? null,
          stream: true,
          resumeData: params.resumeData,
          lastContentId: params.lastContentId,
          userMessage: params.userMessage,
        }),
        signal: controller.signal,
      });

      yield* this.parseStream(response);
    } finally {
      this.abortControllerMap.delete(sessionId);
    }
  }

  async cancelResponse(sessionId: string): Promise<void> {
    this.cancelLocalFetch(sessionId);
    await this.fetcher(`${this.getBaseURL()}/chat/stream/${sessionId}/stop`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.tokenProvider() ?? ""}`,
        "X-Client-Id": this.clientIdProvider(),
      },
    });
  }

  private async *parseStream(response: Response): AsyncGenerator<StreamEvent, void, unknown> {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const errorData = (await response.json()) as { error?: string };
      throw new Error(errorData.error || `获取响应失败：${response.status}`);
    }

    if (!response.body) {
      throw new Error("后端未返回可读流");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) return;

        const parsed = parseSseChunk(decoder.decode(value, { stream: true }), buffer);
        buffer = parsed.buffer;

        for (const event of parsed.events) {
          yield event;
        }

        if (parsed.done) return;
      }
    } finally {
      reader.releaseLock();
    }
  }

  private cancelLocalFetch(sessionId: string): void {
    const abortController = this.abortControllerMap.get(sessionId);
    if (abortController) {
      abortController.abort();
    }
  }
}

function defaultTokenProvider(): string | null {
  return (
    (typeof sessionStorage !== "undefined" && sessionStorage.getItem("token")) ||
    (typeof localStorage !== "undefined" && localStorage.getItem("token")) ||
    null
  );
}
