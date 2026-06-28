import { describe, expect, it } from "vitest";
import { parseSseChunk } from "./stream";

describe("parseSseChunk", () => {
  it("parses data lines and carries incomplete buffered lines", () => {
    const first = parseSseChunk('data: {"type":"text","content":"你', "");

    expect(first.events).toEqual([]);
    expect(first.buffer).toBe('data: {"type":"text","content":"你');

    const second = parseSseChunk('好"}\n\ndata: [DONE]\n', first.buffer);

    expect(second.events).toEqual([{ type: "text", content: "你好" }]);
    expect(second.done).toBe(true);
    expect(second.buffer).toBe("");
  });
});
