import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  MoreVertical,
  Pencil,
  RotateCcw,
  Trash2,
  Wrench,
} from "lucide-react";
import type { Message, MessageContent } from "@mosaic-dock/shared";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { MarkdownContent } from "./MarkdownContent";
import {
  getContentVersions,
  getCurrentTurns,
  groupContentsForDisplay,
  type ContentVersion,
  type ToolCallResponse,
  type ToolCallSummary,
} from "./message-display";

interface ChatMessageItemProps {
  message: Message;
  onFetchToolDetails?: (contentId: string) => Promise<{ toolCalls: unknown[]; toolCallsResponse: unknown[] }>;
  onSwitchVersion?: (messageId: string, contentId: string) => void;
  onRegenerate?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message) => void;
  onContinue?: (message: Message) => void;
}

export function ChatMessageItem({
  message,
  onFetchToolDetails,
  onSwitchVersion,
  onRegenerate,
  onEdit,
  onDelete,
  onContinue,
}: ChatMessageItemProps) {
  const turns = getCurrentTurns(message);
  const activeContent = turns[0];
  const modelName = getMetadataString(activeContent?.metadata?.modelName) ?? "DeepSeek-V3.2";
  const usage = getUsage(activeContent);
  const versions = getContentVersions(message);

  if (message.role === "user") {
    return (
      <article className="flex w-full justify-end gap-3">
        <div className="max-w-[70%] whitespace-pre-wrap rounded-2xl bg-blue-50 px-4 py-3 leading-7 text-blue-700 shadow-sm dark:bg-blue-500/15 dark:text-blue-100">
          {turns.map((content) => content.content ?? "").join("")}
        </div>
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-medium text-white">
          我
        </div>
      </article>
    );
  }

  return (
    <article className="flex w-full gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-950 text-white">
        <Bot className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">智能助手</span>
          <span>{modelName}</span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-[#34363c] dark:bg-[#232428]">
          <div className="space-y-3">
            {groupContentsForDisplay(turns).map((group) =>
              group.type === "content" ? (
                group.items.map((item) => (
                  <MarkdownContent key={item.id} content={item.content ?? ""} />
                ))
              ) : (
                <ProcessGroup key={group.id} items={group.items} onFetchToolDetails={onFetchToolDetails} />
              ),
            )}
          </div>
          <FinishNotice message={message} onContinue={onContinue} />
          {usage ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>Tokens:</span>
              <span>Prompt {usage.promptTokens}</span>
              <span>Completion {usage.completionTokens}</span>
              <span>Total {usage.totalTokens}</span>
            </div>
          ) : null}
        </div>
        <MessageActions
          message={message}
          versions={versions}
          activeContentId={activeContent?.id}
          onSwitchVersion={onSwitchVersion}
          onRegenerate={onRegenerate}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </article>
  );
}

interface ProcessGroupProps {
  items: ReturnType<typeof groupContentsForDisplay>[number]["items"];
  onFetchToolDetails?: (contentId: string) => Promise<{ toolCalls: unknown[]; toolCallsResponse: unknown[] }>;
}

function ProcessGroup({ items, onFetchToolDetails }: ProcessGroupProps) {
  const [expanded, setExpanded] = useState(items.length <= 1);

  return (
    <div className="rounded-lg">
      {items.length > 1 ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((current) => !current)}
        >
          <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} aria-hidden="true" />
          中间处理过程 ({items.length} 个步骤)
        </button>
      ) : null}
      {expanded ? (
        <div className="space-y-2">
          {items.map((item) =>
            item.type === "think" ? (
              <ThinkingSection key={item.id} content={item.reasoningContent ?? ""} source={item.source} />
            ) : item.type === "tool" ? (
              <ToolCallsSection
                key={item.id}
                contentId={item.source.id}
                toolCalls={item.toolCalls ?? []}
                toolResponses={item.toolResponses ?? []}
                onFetchToolDetails={onFetchToolDetails}
              />
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  );
}

function ThinkingSection({ content, source }: { content: string; source: MessageContent }) {
  const [expanded, setExpanded] = useState(false);
  const isThinking = source.state?.isThinking;
  const duration = formatDuration(source.thinkingDurationMs ?? source.metadata?.thinkingDurationMs);

  return (
    <div>
      <button
        type="button"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded((current) => !current)}
      >
        <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} aria-hidden="true" />
        {isThinking ? "思考中..." : "已深度思考"}
        {duration ? <span className="text-xs text-slate-400">{duration}</span> : null}
      </button>
      {expanded ? (
        <div className="mt-2 border-l-2 border-slate-200 pl-4 text-sm text-muted-foreground">
          <MarkdownContent content={content} />
        </div>
      ) : null}
    </div>
  );
}

function ToolCallsSection({
  contentId,
  toolCalls,
  toolResponses,
  onFetchToolDetails,
}: {
  contentId: string;
  toolCalls: ToolCallSummary[];
  toolResponses: ToolCallResponse[];
  onFetchToolDetails?: (contentId: string) => Promise<{ toolCalls: unknown[]; toolCallsResponse: unknown[] }>;
}) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<{ toolCalls: unknown[]; toolCallsResponse: unknown[] } | null>(null);

  async function openDetails() {
    setOpen(true);
    if (!details && onFetchToolDetails) {
      setDetails(await onFetchToolDetails(contentId));
    }
  }

  return (
    <div className="space-y-1">
      {toolCalls.map((tool, index) => (
        <button
          key={`${tool.name ?? "tool"}-${index}`}
          type="button"
          className="flex max-w-full items-center gap-2 rounded-md py-1 text-left text-sm text-muted-foreground hover:text-foreground"
          onClick={() => void openDetails()}
        >
          <Wrench className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="font-medium text-slate-700 dark:text-slate-200">{getToolAction(tool)}</span>
          {getToolArgs(tool) ? <span className="truncate">{getToolArgs(tool)}</span> : null}
          <span className="sr-only">工具调用</span>
        </button>
      ))}
      {open ? (
        <div role="dialog" aria-label="工具调用详情" className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-[#34363c] dark:bg-[#1f2024]">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4 text-green-500" aria-hidden="true" />
            工具调用详情
          </div>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">
            {JSON.stringify(details ?? { toolCalls, toolCallsResponse: toolResponses }, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function MessageActions({
  message,
  versions,
  onSwitchVersion,
  onRegenerate,
  onEdit,
  onDelete,
}: {
  message: Message;
  versions: ContentVersion[];
  activeContentId?: string;
  onSwitchVersion?: (messageId: string, contentId: string) => void;
  onRegenerate?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (moreButtonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpen]);

  if (message.state?.isStreaming) return null;

  function toggleMenu() {
    const rect = moreButtonRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.right,
      });
    }
    setMenuOpen((current) => !current);
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1 text-muted-foreground">
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => copyMessage(message)}>
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        复制
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => onRegenerate?.(message)}>
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        重新生成
      </Button>
      <VersionPager message={message} versions={versions} onSwitchVersion={onSwitchVersion} />
      <div className="relative inline-flex">
        <Button
          ref={moreButtonRef}
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          aria-label="更多操作"
          aria-expanded={menuOpen}
          onClick={toggleMenu}
        >
          <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        {menuOpen
          ? createPortal(
              <div
                ref={menuRef}
                role="menu"
                aria-label="更多消息操作"
                className="fixed z-50 min-w-32 -translate-x-full rounded-md border border-slate-200 bg-white py-1 text-sm text-slate-700 shadow-lg dark:border-[#34363c] dark:bg-[#232428] dark:text-slate-200"
                style={{
                  top: menuPosition?.top ?? 0,
                  left: menuPosition?.left ?? 0,
                }}
              >
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-[#2a2c30]"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit?.(message);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  编辑内容
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete?.(message);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  删除消息
                </button>
              </div>,
              document.body,
            )
          : null}
      </div>
    </div>
  );
}

function VersionPager({
  message,
  versions,
  onSwitchVersion,
}: {
  message: Message;
  versions: ContentVersion[];
  onSwitchVersion?: (messageId: string, contentId: string) => void;
}) {
  if (versions.length <= 1) return null;

  const currentIndex = Math.max(
    0,
    versions.findIndex((version) => version.turnsId === message.currentTurnsId),
  );
  const currentVersion = versions[currentIndex] ?? versions[0]!;
  const previousVersion = versions[currentIndex - 1];
  const nextVersion = versions[currentIndex + 1];

  return (
    <div
      role="group"
      aria-label="回答版本切换"
      className="inline-flex h-6 items-center overflow-hidden rounded border border-slate-200 bg-transparent text-xs font-medium text-slate-600 dark:border-[#34363c] dark:text-slate-300"
    >
      <button
        type="button"
        aria-label="上一个版本"
        disabled={!previousVersion}
        className="grid h-full w-6 place-items-center hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 dark:hover:bg-[#2a2c30] dark:disabled:text-slate-600"
        onClick={() => previousVersion && onSwitchVersion?.(message.id, previousVersion.contentId)}
      >
        <ChevronLeft className="h-3 w-3" aria-hidden="true" />
      </button>
      <span className="border-x border-slate-200 px-1.5 leading-6 tabular-nums dark:border-[#34363c]">
        {currentVersion.index} / {versions.length}
      </span>
      <button
        type="button"
        aria-label="下一个版本"
        disabled={!nextVersion}
        className="grid h-full w-6 place-items-center hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 dark:hover:bg-[#2a2c30] dark:disabled:text-slate-600"
        onClick={() => nextVersion && onSwitchVersion?.(message.id, nextVersion.contentId)}
      >
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}

function FinishNotice({ message, onContinue }: { message: Message; onContinue?: (message: Message) => void }) {
  const content = getCurrentTurns(message)[0];
  const finishReason = getMetadataString(content?.metadata?.finishReason);
  const error = getMetadataString(content?.metadata?.error);

  if (finishReason === "error") {
    return <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error || "API 请求错误"}</div>;
  }

  if (finishReason === "max_iterations_reached") {
    return (
      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
        <p className="font-medium">已达到最大工具调用轮次限制</p>
        <Button type="button" size="sm" className="mt-2" onClick={() => onContinue?.(message)}>
          继续执行
        </Button>
      </div>
    );
  }

  return null;
}

function getUsage(content?: MessageContent) {
  const usage = content?.metadata?.usage;
  if (!usage || typeof usage !== "object") return null;
  const typed = usage as { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  if (typeof typed.totalTokens !== "number") return null;
  return {
    promptTokens: typed.promptTokens ?? 0,
    completionTokens: typed.completionTokens ?? 0,
    totalTokens: typed.totalTokens,
  };
}

function getToolAction(tool: ToolCallSummary): string {
  const display = tool.metadata?.displayMessage;
  if (typeof display === "string") return display;
  if (display && typeof display === "object") return display.action ?? tool.name ?? "工具调用";
  return tool.name ?? "工具调用";
}

function getToolArgs(tool: ToolCallSummary): string {
  const display = tool.metadata?.displayMessage;
  if (display && typeof display === "object" && typeof display.args === "string") return display.args;
  return "";
}

function getMetadataString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function formatDuration(value: unknown): string {
  if (typeof value !== "number" || value <= 0) return "";
  const seconds = value / 1000;
  return seconds < 60 ? `${seconds.toFixed(1)}s` : `${Math.floor(seconds / 60)}分${(seconds % 60).toFixed(1)}秒`;
}

function copyMessage(message: Message) {
  const text = getCurrentTurns(message).map((content) => content.content ?? "").join("\n");
  void navigator.clipboard?.writeText(text);
}
