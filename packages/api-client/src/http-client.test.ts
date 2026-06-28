import { describe, expect, it } from "vitest";
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { ApiClient } from "./http-client";

function createAdapter(payload: unknown, status = 200) {
  const calls: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    calls.push(config as InternalAxiosRequestConfig);
    return {
      data: payload,
      status,
      statusText: String(status),
      headers: { "content-type": "application/json" },
      config: config as InternalAxiosRequestConfig,
    };
  };

  return { adapter, calls };
}

function requestData(config: InternalAxiosRequestConfig): unknown {
  if (typeof config.data !== "string") return config.data;
  return JSON.parse(config.data) as unknown;
}

describe("ApiClient", () => {
  it("uses /api/v1 as the default base URL and attaches auth headers", async () => {
    const { adapter, calls } = createAdapter({ ok: true });

    const client = new ApiClient({
      adapter,
      tokenProvider: () => "token-123",
      clientIdProvider: () => "client-123",
    });

    await client.request("/sessions");

    expect(calls[0]).toMatchObject({
      baseURL: "/api/v1",
      url: "/sessions",
      method: "get",
    });
    expect(calls[0]?.headers.get("Authorization")).toBe("Bearer token-123");
    expect(calls[0]?.headers.get("X-Client-Id")).toBe("client-123");
  });

  it("turns backend error payloads into friendly errors", async () => {
    const { adapter } = createAdapter({ message: "模型不存在" }, 400);

    const client = new ApiClient({ adapter });

    await expect(client.request("/models/missing")).rejects.toThrow("模型不存在");
  });

  it("fetches new-session bootstrap resources from legacy endpoints", async () => {
    const { adapter, calls } = createAdapter({ items: [] });
    const client = new ApiClient({
      adapter,
      tokenProvider: () => null,
      clientIdProvider: () => "client-123",
    });

    await client.fetchSessionGroups();
    await client.fetchKnowledgeBases();
    await client.fetchSkills();
    await client.fetchAppearanceSettings();
    await client.fetchCharacters();
    await client.fetchTeams();

    expect(calls.map((config) => config.url)).toEqual([
      "/session-groups",
      "/knowledge-bases",
      "/skills",
      "/settings/appearance",
      "/characters",
      "/teams",
    ]);
  });

  it("manages session groups with legacy endpoints", async () => {
    const { adapter, calls } = createAdapter({ success: true });
    const client = new ApiClient({
      adapter,
      tokenProvider: () => null,
      clientIdProvider: () => "client-123",
    });

    await client.createSessionGroup({ name: "研发任务" });
    await client.updateSessionGroup("group-1", { name: "客户项目" });
    await client.deleteSessionGroup("group-2");
    await client.reorderSessionGroups(["group-3", "group-1"]);

    expect(calls.map((config) => config.url)).toEqual([
      "/session-groups",
      "/session-groups/group-1",
      "/session-groups/group-2",
      "/session-groups/reorder",
    ]);
    expect(calls.map((config) => config.method)).toEqual([
      "post",
      "put",
      "delete",
      "post",
    ]);
    expect(calls.map(requestData)).toEqual([
      { name: "研发任务" },
      { name: "客户项目" },
      undefined,
      { groupIds: ["group-3", "group-1"] },
    ]);
  });

  it("updates and deletes sessions with legacy endpoints", async () => {
    const { adapter, calls } = createAdapter({ success: true });
    const client = new ApiClient({
      adapter,
      tokenProvider: () => null,
      clientIdProvider: () => "client-123",
    });

    await client.updateSession("session-1", { title: "新的任务名称" });
    await client.updateSession("session-1", { groupId: "group-1" });
    await client.deleteSession("session-1");
    await client.deleteSession("session-2", { deleteWorkspace: true });

    expect(calls.map((config) => config.url)).toEqual([
      "/sessions/session-1",
      "/sessions/session-1",
      "/sessions/session-1",
      "/sessions/session-2",
    ]);
    expect(calls.map((config) => config.method)).toEqual([
      "put",
      "put",
      "delete",
      "delete",
    ]);
    expect(calls.map(requestData)).toEqual([
      { title: "新的任务名称" },
      { groupId: "group-1" },
      undefined,
      undefined,
    ]);
    expect(calls[3]?.params).toEqual({ deleteWorkspace: true });
  });

  it("manages characters and character groups with legacy endpoints", async () => {
    const { adapter, calls } = createAdapter({ success: true });
    const client = new ApiClient({
      adapter,
      tokenProvider: () => null,
      clientIdProvider: () => "client-123",
    });

    await client.fetchCharacters({ groupId: "group-1", skip: 10, limit: 30 });
    await client.fetchCharacter("character-1");
    await client.createCharacter({
      title: "产品经理",
      description: "负责产品策略和用户故事",
      systemPrompt: "你是产品经理",
      groupId: "group-1",
      settings: { temperature: 0.7 },
    });
    await client.updateCharacter("character-1", {
      title: "资深产品经理",
      groupId: null,
    });
    await client.deleteCharacter("character-2");
    await client.fetchCharacterGroups();
    await client.createCharacterGroup({ name: "写作" });
    await client.updateCharacterGroup("group-1", { name: "产品" });
    await client.deleteCharacterGroup("group-2");
    await client.fetchCharacterTools("character-1");

    expect(calls.map((config) => config.url)).toEqual([
      "/characters",
      "/characters/character-1",
      "/characters",
      "/characters/character-1",
      "/characters/character-2",
      "/character-groups",
      "/character-groups",
      "/character-groups/group-1",
      "/character-groups/group-2",
      "/characters/character-1/tools",
    ]);
    expect(calls.map((config) => config.method)).toEqual([
      "get",
      "get",
      "post",
      "put",
      "delete",
      "get",
      "post",
      "put",
      "delete",
      "get",
    ]);
    expect(calls[0]?.params).toEqual({ groupId: "group-1", skip: 10, limit: 30 });
    expect(calls.map(requestData)).toEqual([
      undefined,
      undefined,
      {
        title: "产品经理",
        description: "负责产品策略和用户故事",
        systemPrompt: "你是产品经理",
        groupId: "group-1",
        settings: { temperature: 0.7 },
      },
      { title: "资深产品经理", groupId: null },
      undefined,
      undefined,
      { name: "写作" },
      { name: "产品" },
      undefined,
      undefined,
    ]);
  });

  it("fetches workspace tree and children with legacy endpoints", async () => {
    const { adapter, calls } = createAdapter({ tree: [] });
    const client = new ApiClient({
      adapter,
      tokenProvider: () => null,
      clientIdProvider: () => "client-123",
    });

    await client.fetchWorkspaceTree("session-1");
    await client.fetchWorkspaceChildren("session-1", "src/components");

    expect(calls.map((config) => config.url)).toEqual([
      "/sessions/session-1/workspace/tree",
      "/sessions/session-1/workspace/children",
    ]);
    expect(calls[1]?.params).toEqual({ path: "src/components" });
  });

  it("manages message content and message actions with legacy endpoints", async () => {
    const { adapter, calls } = createAdapter({ success: true });
    const client = new ApiClient({
      adapter,
      tokenProvider: () => null,
      clientIdProvider: () => "client-123",
    });

    await client.fetchMessageContentToolDetails("content-1");
    await client.updateMessageActiveContent("content-2", "message-1");
    await client.updateMessage("message-2", { content: "更新后的内容" });
    await client.deleteMessage("message-3");

    expect(calls.map((config) => config.url)).toEqual([
      "/message-content/content-1/tool-details",
      "/message-content/content-2/active",
      "/messages/message-2",
      "/messages/message-3",
    ]);
    expect(calls.map((config) => config.method)).toEqual([
      "get",
      "put",
      "put",
      "delete",
    ]);
    expect(calls.map(requestData)).toEqual([
      undefined,
      { message_id: "message-1" },
      { content: "更新后的内容" },
      undefined,
    ]);
  });
});
