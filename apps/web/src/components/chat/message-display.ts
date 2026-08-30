import type { Message, MessageContent } from "@mosaic-dock/shared";

export type DisplayGroupType = "content" | "process";
export type DisplayItemType = "content" | "think" | "tool";

export interface ToolDisplayInfo {
  action?: string;
  args?: string;
  toolName?: string;
  toolType?: string;
  extra?: Record<string, unknown>;
}

export interface ToolCallSummary {
  name?: string;
  arguments?: unknown;
  args?: unknown;
  metadata?: {
    displayMessage?: ToolDisplayInfo | string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ToolCallResponse {
  name?: string;
  content?: string;
  toolCallId?: string;
  [key: string]: unknown;
}

export interface DisplayItem {
  id: string;
  type: DisplayItemType;
  content?: string;
  reasoningContent?: string;
  toolCalls?: ToolCallSummary[];
  toolResponses?: ToolCallResponse[];
  source: MessageContent;
}

export interface DisplayGroup {
  id: string;
  type: DisplayGroupType;
  items: DisplayItem[];
  isCollapsible: boolean;
}

export interface ContentVersion {
  turnsId: string;
  contentId: string;
  index: number;
}

export function getCurrentTurns(message: Message): MessageContent[] {
  const contents = message.contents.filter(Boolean);

  if (message.role !== "assistant" || !message.currentTurnsId) {
    return contents;
  }

  const matched = contents.filter((content) => content.turnsId === message.currentTurnsId);
  return matched.length > 0 ? matched : contents;
}

export function getContentVersions(message: Message): ContentVersion[] {
  const versions: ContentVersion[] = [];
  const seenTurnsIds = new Set<string>();

  for (const content of message.contents) {
    if (!content.turnsId || seenTurnsIds.has(content.turnsId)) continue;

    seenTurnsIds.add(content.turnsId);
    versions.push({
      turnsId: content.turnsId,
      contentId: content.id,
      index: versions.length + 1,
    });
  }

  return versions;
}

export function groupContentsForDisplay(contents: MessageContent[]): DisplayGroup[] {
  const groups: DisplayGroup[] = [];
  let processItems: DisplayItem[] = [];

  function flushProcess() {
    if (processItems.length === 0) return;

    groups.push({
      id: `process-${processItems[0]?.id ?? groups.length}`,
      type: "process",
      items: processItems,
      isCollapsible: processItems.length > 1 || processItems.some((item) => (item.toolCalls?.length ?? 0) > 1),
    });
    processItems = [];
  }

  for (const content of contents) {
    for (const item of flattenContent(content)) {
      if (item.type === "content") {
        flushProcess();
        groups.push({
          id: `content-${item.id}`,
          type: "content",
          items: [item],
          isCollapsible: false,
        });
      } else {
        processItems.push(item);
      }
    }
  }

  flushProcess();
  return groups;
}

function flattenContent(content: MessageContent): DisplayItem[] {
  const items: DisplayItem[] = [];

  if (content.reasoningContent?.trim()) {
    items.push({
      id: `${content.id}-think`,
      type: "think",
      reasoningContent: content.reasoningContent,
      source: content,
    });
  }

  if (content.content?.trim()) {
    items.push({
      id: `${content.id}-content`,
      type: "content",
      content: content.content,
      source: content,
    });
  }

  const toolCalls = asArray<ToolCallSummary>(content.metadata?.toolCalls);
  const toolResponses = asArray<ToolCallResponse>(content.metadata?.toolCallsResponse);
  if (toolCalls.length > 0) {
    items.push({
      id: `${content.id}-tool`,
      type: "tool",
      toolCalls,
      toolResponses,
      source: content,
    });
  }

  return items;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
