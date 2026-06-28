import type { Message } from "@mosaic-dock/shared";
import { describe, expect, it } from "vitest";
import { getCurrentTurns, groupContentsForDisplay } from "./message-display";

const assistantMessage = (overrides: Partial<Message> = {}): Message => ({
  id: "message-1",
  role: "assistant",
  currentTurnsId: "turn-1",
  state: { isStreaming: false },
  contents: [
    {
      id: "content-1",
      turnsId: "turn-1",
      content: "正文",
      reasoningContent: "思考",
      state: { isStreaming: false },
      metadata: {
        toolCalls: [{ name: "file.write", metadata: { displayMessage: "已写入文件 README.md" } }],
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
  ...overrides,
});

describe("message-display", () => {
  it("filters assistant content by currentTurnsId", () => {
    expect(getCurrentTurns(assistantMessage()).map((item) => item.id)).toEqual(["content-1"]);
  });

  it("groups reasoning, markdown content, and tool calls for display", () => {
    const groups = groupContentsForDisplay(getCurrentTurns(assistantMessage()));

    expect(groups.map((group) => group.type)).toEqual(["process", "content", "process"]);
    expect(groups[0]?.items[0]?.type).toBe("think");
    expect(groups[1]?.items[0]?.content).toBe("正文");
    expect(groups[2]?.items[0]?.type).toBe("tool");
    expect(groups[2]?.items[0]?.toolResponses).toEqual([
      { name: "file.write", content: "ok", toolCallId: "tool-1" },
    ]);
  });

  it("returns all user contents without turns filtering", () => {
    const message: Message = {
      id: "user-1",
      role: "user",
      state: { isStreaming: false },
      contents: [
        { id: "u1", content: "第一段", state: { isStreaming: false } },
        { id: "u2", content: "第二段", state: { isStreaming: false } },
      ],
    };

    expect(getCurrentTurns(message).map((item) => item.id)).toEqual(["u1", "u2"]);
  });
});
