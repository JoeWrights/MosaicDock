import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "./http-client";

describe("ApiClient", () => {
  it("uses /api/v1 as the default base URL and attaches auth headers", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ ok: true }),
    })) as unknown as typeof fetch & { mock: { calls: Parameters<typeof fetch>[] } };

    const client = new ApiClient({
      fetcher,
      tokenProvider: () => "token-123",
      clientIdProvider: () => "client-123",
    });

    await client.request("/sessions");

    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/sessions",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );

    const [, init] = fetcher.mock.calls[0]!;
    const headers = init?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token-123");
    expect(headers.get("X-Client-Id")).toBe("client-123");
  });

  it("turns backend error payloads into friendly errors", async () => {
    const fetcher = vi.fn(async () => ({
      ok: false,
      status: 400,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ message: "模型不存在" }),
    })) as unknown as typeof fetch;

    const client = new ApiClient({ fetcher });

    await expect(client.request("/models/missing")).rejects.toThrow("模型不存在");
  });

  it("fetches new-session bootstrap resources from legacy endpoints", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ items: [] }),
    })) as unknown as typeof fetch & { mock: { calls: Parameters<typeof fetch>[] } };
    const client = new ApiClient({
      fetcher,
      tokenProvider: () => null,
      clientIdProvider: () => "client-123",
    });

    await client.fetchSessionGroups();
    await client.fetchKnowledgeBases();
    await client.fetchSkills();
    await client.fetchAppearanceSettings();
    await client.fetchCharacters();
    await client.fetchTeams();

    const urls = fetcher.mock.calls.map(([url]) => url);
    expect(urls).toEqual([
      "/api/v1/session-groups",
      "/api/v1/knowledge-bases",
      "/api/v1/skills",
      "/api/v1/settings/appearance",
      "/api/v1/characters",
      "/api/v1/teams",
    ]);
  });

  it("manages session groups with legacy endpoints", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true }),
    })) as unknown as typeof fetch & { mock: { calls: Parameters<typeof fetch>[] } };
    const client = new ApiClient({
      fetcher,
      tokenProvider: () => null,
      clientIdProvider: () => "client-123",
    });

    await client.createSessionGroup({ name: "研发任务" });
    await client.updateSessionGroup("group-1", { name: "客户项目" });
    await client.deleteSessionGroup("group-2");
    await client.reorderSessionGroups(["group-3", "group-1"]);

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/session-groups",
      "/api/v1/session-groups/group-1",
      "/api/v1/session-groups/group-2",
      "/api/v1/session-groups/reorder",
    ]);
    expect(fetcher.mock.calls.map(([, init]) => init?.method)).toEqual([
      "POST",
      "PUT",
      "DELETE",
      "POST",
    ]);
    expect(fetcher.mock.calls.map(([, init]) => init?.body)).toEqual([
      JSON.stringify({ name: "研发任务" }),
      JSON.stringify({ name: "客户项目" }),
      undefined,
      JSON.stringify({ groupIds: ["group-3", "group-1"] }),
    ]);
  });

  it("updates and deletes sessions with legacy endpoints", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true }),
    })) as unknown as typeof fetch & { mock: { calls: Parameters<typeof fetch>[] } };
    const client = new ApiClient({
      fetcher,
      tokenProvider: () => null,
      clientIdProvider: () => "client-123",
    });

    await client.updateSession("session-1", { title: "新的任务名称" });
    await client.updateSession("session-1", { groupId: "group-1" });
    await client.deleteSession("session-1");
    await client.deleteSession("session-2", { deleteWorkspace: true });

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/sessions/session-1",
      "/api/v1/sessions/session-1",
      "/api/v1/sessions/session-1",
      "/api/v1/sessions/session-2?deleteWorkspace=true",
    ]);
    expect(fetcher.mock.calls.map(([, init]) => init?.method)).toEqual([
      "PUT",
      "PUT",
      "DELETE",
      "DELETE",
    ]);
    expect(fetcher.mock.calls.map(([, init]) => init?.body)).toEqual([
      JSON.stringify({ title: "新的任务名称" }),
      JSON.stringify({ groupId: "group-1" }),
      undefined,
      undefined,
    ]);
  });
});
