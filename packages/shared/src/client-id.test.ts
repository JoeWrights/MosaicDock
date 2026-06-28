import { describe, expect, it } from "vitest";
import { getClientId, refreshClientId } from "./client-id";

describe("client id", () => {
  it("keeps a stable id until refreshed", () => {
    const first = getClientId();
    const second = getClientId();

    expect(first).toBe(second);
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    const refreshed = refreshClientId();
    expect(refreshed).not.toBe(first);
  });
});
