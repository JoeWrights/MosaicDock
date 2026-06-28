import { describe, expect, it, vi } from "vitest";
import { formatTime } from "./time";

describe("formatTime", () => {
  it("returns friendly labels for recent days", () => {
    vi.setSystemTime(new Date("2026-06-27T12:00:00+08:00"));

    expect(formatTime("2026-06-27T09:30:00+08:00")).toBe("09:30");
    expect(formatTime("2026-06-26T09:30:00+08:00")).toBe("昨天");
    expect(formatTime("2026-06-25T09:30:00+08:00")).toBe("前天");

    vi.useRealTimers();
  });

  it("returns an empty string for invalid input", () => {
    expect(formatTime("")).toBe("");
    expect(formatTime("not-a-date")).toBe("");
  });
});
