import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Message } from "@mosaic-dock/shared";
import { describe, expect, it, vi } from "vitest";
import { ChatMessageItem } from "./ChatMessageItem";

const assistantMessage = (): Message => ({
  id: "assistant-1",
  role: "assistant",
  currentTurnsId: "turn-1",
  state: { isStreaming: false },
  contents: [
    {
      id: "content-1",
      turnsId: "turn-1",
      content: "## 完成\n\n```ts\nconst ok = true;\n```",
      reasoningContent: "先检查上下文，再生成答案。",
      thinkingDurationMs: 1200,
      state: { isStreaming: false },
      metadata: {
        modelName: "DeepSeek-V3.2",
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        toolCalls: [{ name: "file.write", metadata: { displayMessage: { action: "已写入文件", args: "README.md" } } }],
        toolCallsResponse: [{ name: "file.write", content: "ok", toolCallId: "tool-1" }],
      },
    },
    {
      id: "content-2",
      turnsId: "turn-2",
      content: "旧版本",
      state: { isStreaming: false },
    },
  ],
});

describe("ChatMessageItem", () => {
  it("renders backend messages that omit state fields", () => {
    const { state: _messageState, contents, ...messageWithoutState } = assistantMessage();
    const [{ state: _contentState, ...firstContentWithoutState }, ...restContents] = contents;
    const message = {
      ...messageWithoutState,
      contents: [firstContentWithoutState, ...restContents],
    };

    render(<ChatMessageItem message={message as Message} />);

    expect(screen.getByText("智能助手")).toBeInTheDocument();
    expect(screen.getByText("完成")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /重新生成/ })).toBeInTheDocument();
  });

  it("renders assistant rich answer sections", () => {
    render(<ChatMessageItem message={assistantMessage()} />);

    expect(screen.getByText("智能助手")).toBeInTheDocument();
    expect(screen.getByText("DeepSeek-V3.2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /已深度思考/ })).toBeInTheDocument();
    expect(screen.getByText("完成")).toBeInTheDocument();
    expect(screen.getByText("ts")).toBeInTheDocument();
    expect(screen.getByText("已写入文件")).toBeInTheDocument();
    expect(screen.getByText("README.md")).toBeInTheDocument();
    expect(screen.getByText("Prompt 10")).toBeInTheDocument();
    expect(screen.getByText("Completion 20")).toBeInTheDocument();
    expect(screen.getByText("Total 30")).toBeInTheDocument();
  });

  it("opens tool details and switches content versions with Guada-style pager", async () => {
    const user = userEvent.setup();
    const onFetchToolDetails = vi.fn(async () => ({
      toolCalls: [{ name: "file.write", arguments: { path: "README.md" } }],
      toolCallsResponse: [{ name: "file.write", content: "ok", toolCallId: "tool-1" }],
    }));
    const onSwitchVersion = vi.fn();
    render(
      <ChatMessageItem
        message={assistantMessage()}
        onFetchToolDetails={onFetchToolDetails}
        onSwitchVersion={onSwitchVersion}
      />,
    );

    await user.click(screen.getByRole("button", { name: /工具调用/ }));
    expect(await screen.findByText("工具调用详情")).toBeInTheDocument();
    expect(onFetchToolDetails).toHaveBeenCalledWith("content-1");

    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /版本 2/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "下一个版本" }));
    expect(onSwitchVersion).toHaveBeenCalledWith("assistant-1", "content-2");
  });

  it("shows one switch action per answer version, not per content chunk", () => {
    const message = assistantMessage();
    message.contents = [
      message.contents[0]!,
      {
        id: "content-1-tool",
        turnsId: "turn-1",
        content: null,
        state: { isStreaming: false },
        metadata: { toolCalls: [{ name: "file.read" }] },
      },
      message.contents[1]!,
    ];

    render(<ChatMessageItem message={message} />);

    expect(screen.queryByRole("button", { name: /版本 1/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /版本 2/ })).not.toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下一个版本" })).toBeInTheDocument();
  });

  it("uses compact Guada-style version pager styling", () => {
    render(<ChatMessageItem message={assistantMessage()} />);

    const pager = screen.getByRole("group", { name: "回答版本切换" });
    expect(pager).toHaveClass("h-6", "rounded", "border-slate-200");
    expect(pager).not.toHaveClass("shadow-sm");
  });

  it("moves edit and delete actions into a Guada-style more menu", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<ChatMessageItem message={assistantMessage()} onEdit={onEdit} onDelete={onDelete} />);

    expect(screen.queryByRole("button", { name: /删除/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "更多操作" }));

    const menu = screen.getByRole("menu", { name: "更多消息操作" });
    expect(menu.parentElement).toBe(document.body);
    expect(menu).toHaveClass("fixed");
    expect(menu).not.toHaveClass("absolute");
    expect(screen.getByRole("menuitem", { name: "编辑内容" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "删除消息" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "编辑内容" }));
    expect(onEdit).toHaveBeenCalledWith(assistantMessage());

    await user.click(screen.getByRole("button", { name: "更多操作" }));
    await user.click(screen.getByRole("menuitem", { name: "删除消息" }));
    expect(onDelete).toHaveBeenCalledWith(assistantMessage());
  });

  it("closes the more menu when clicking outside", async () => {
    const user = userEvent.setup();
    render(<ChatMessageItem message={assistantMessage()} />);

    await user.click(screen.getByRole("button", { name: "更多操作" }));
    expect(screen.getByRole("menu", { name: "更多消息操作" })).toBeInTheDocument();

    await user.click(screen.getByText("智能助手"));
    expect(screen.queryByRole("menu", { name: "更多消息操作" })).not.toBeInTheDocument();
  });
});
