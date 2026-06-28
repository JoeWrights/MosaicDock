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

  it("manages plugin market resources with legacy endpoints", async () => {
    const { adapter, calls } = createAdapter({ success: true });
    const client = new ApiClient({
      adapter,
      tokenProvider: () => null,
      clientIdProvider: () => "client-123",
    });

    await client.fetchGlobalPlugins();
    await client.updateGlobalPluginStatus("file-tools", false);
    await client.triggerSkillScan();
    await client.toggleSkill("skill-creator", true);
    await client.toggleSkill("skill-creator", false);
    await client.reloadSkill("skill-creator");
    await client.fetchSkillDocumentation("skill-creator");
    await client.installSkill(new File(["zip-bytes"], "skill.zip", { type: "application/zip" }), true);
    await client.installSkillFromUrl("https://ai.dingd.cn/skills/content-research-writer.zip", true);
    await client.uninstallSkill("custom-skill");
    await client.toggleMcpServer("mcp-1", true);
    await client.refreshMcpServerTools("mcp-1");

    expect(calls.map((config) => config.url)).toEqual([
      "/settings/plugins/global",
      "/settings/plugins/global",
      "/skills/scan",
      "/skills/skill-creator/enable",
      "/skills/skill-creator/disable",
      "/skills/skill-creator/reload",
      "/skills/skill-creator/documentation",
      "/skills/install",
      "/skills/install-from-url",
      "/skills/custom-skill/uninstall",
      "/mcp-servers/mcp-1/toggle",
      "/mcp-servers/mcp-1/refresh-tools",
    ]);
    expect(calls.map((config) => config.method)).toEqual([
      "get",
      "put",
      "post",
      "post",
      "post",
      "post",
      "get",
      "post",
      "post",
      "post",
      "patch",
      "post",
    ]);
    expect(calls.map(requestData)).toEqual([
      undefined,
      { pluginId: "file-tools", enabled: false },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      expect.any(FormData),
      { url: "https://ai.dingd.cn/skills/content-research-writer.zip", force: true },
      undefined,
      { enabled: true },
      undefined,
    ]);
    expect(calls[7]?.headers.get("Content-Type")).toBe("multipart/form-data");
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

  it("manages knowledge bases and files with legacy endpoints", async () => {
    const { adapter, calls } = createAdapter({ success: true });
    const client = new ApiClient({
      adapter,
      tokenProvider: () => null,
      clientIdProvider: () => "client-123",
    });
    const file = new File(["hello"], "产品说明.md", { type: "text/markdown" });

    await client.fetchKnowledgeBases({ skip: 0, limit: 20 });
    await client.createKnowledgeBase({
      name: "产品知识库",
      description: "沉淀产品文档",
      embeddingModelId: "embedding-1",
    });
    await client.updateKnowledgeBase("kb-1", {
      name: "新版产品知识库",
      embeddingModelId: "embedding-2",
      chunkMaxSize: 1200,
      isPublic: true,
    });
    await client.deleteKnowledgeBase("kb-2");
    await client.fetchKnowledgeBaseFiles("kb-1", { skip: 0, limit: 50 });
    await client.uploadKnowledgeBaseFile("kb-1", file, "需求");
    await client.createKnowledgeBaseFolder("kb-1", { folderName: "设计稿", parentFolderId: null });
    await client.renameKnowledgeBaseFile("kb-1", "file-1", { newName: "PRD.md" });
    await client.deleteKnowledgeBaseFile("kb-1", "file-2");
    await client.retryKnowledgeBaseFile("kb-1", "file-3");

    expect(calls.map((config) => config.url)).toEqual([
      "/knowledge-bases",
      "/knowledge-bases",
      "/knowledge-bases/kb-1",
      "/knowledge-bases/kb-2",
      "/knowledge-bases/kb-1/files",
      "/knowledge-bases/kb-1/files/upload",
      "/knowledge-bases/kb-1/files/folder",
      "/knowledge-bases/kb-1/files/file-1/rename",
      "/knowledge-bases/kb-1/files/file-2",
      "/knowledge-bases/kb-1/files/file-3/retry",
    ]);
    expect(calls.map((config) => config.method)).toEqual([
      "get",
      "post",
      "put",
      "delete",
      "get",
      "post",
      "post",
      "post",
      "delete",
      "post",
    ]);
    expect(calls[0]?.params).toEqual({ skip: 0, limit: 20 });
    expect(requestData(calls[1]!)).toEqual({
      name: "产品知识库",
      description: "沉淀产品文档",
      embeddingModelId: "embedding-1",
    });
    expect(requestData(calls[2]!)).toEqual({
      name: "新版产品知识库",
      embedding_model_id: "embedding-2",
      chunk_max_size: 1200,
      is_public: true,
    });
    expect(calls[4]?.params).toEqual({ skip: 0, limit: 50 });
    expect(calls[5]?.data).toBeInstanceOf(FormData);
    expect(calls[5]?.headers.get("Content-Type")).toBe("multipart/form-data");
    expect(requestData(calls[6]!)).toEqual({ folderName: "设计稿", parentFolderId: null });
    expect(requestData(calls[7]!)).toEqual({ newName: "PRD.md" });
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
      groupId: "group-1",
      settings: { systemPrompt: "你是产品经理", temperature: 0.7 },
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
    await client.fetchMcpServers();

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
      "/mcp-servers",
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
      "get",
    ]);
    expect(calls[0]?.params).toEqual({ groupId: "group-1", skip: 10, limit: 30 });
    expect(calls.map(requestData)).toEqual([
      undefined,
      undefined,
      {
        title: "产品经理",
        description: "负责产品策略和用户故事",
        groupId: "group-1",
        settings: { systemPrompt: "你是产品经理", temperature: 0.7 },
      },
      { title: "资深产品经理", groupId: null },
      undefined,
      undefined,
      { name: "写作" },
      { name: "产品" },
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("uploads character avatars as multipart form data", async () => {
    const { adapter, calls } = createAdapter({ url: "/uploads/avatars/avatar.jpg" });
    const client = new ApiClient({
      adapter,
      tokenProvider: () => null,
      clientIdProvider: () => "client-123",
    });
    const avatar = new File(["avatar-bytes"], "avatar.png", { type: "image/png" });

    await client.uploadCharacterAvatar("character-1", avatar);

    expect(calls[0]).toMatchObject({
      url: "/characters/character-1/avatars",
      method: "post",
    });
    expect(calls[0]?.data).toBeInstanceOf(FormData);
    expect(calls[0]?.headers.get("Content-Type")).toBe("multipart/form-data");
  });

  it("manages bot admin instances with backend endpoints", async () => {
    const { adapter, calls } = createAdapter({ success: true });
    const client = new ApiClient({
      adapter,
      tokenProvider: () => null,
      clientIdProvider: () => "client-123",
    });

    await client.fetchBotInstances();
    await client.createBotInstance({
      platform: "mock",
      name: "测试机器人",
      platformConfig: {},
      defaultCharacterId: "character-1",
      autoStart: false,
    });
    await client.updateBotInstance("bot-1", { name: "客服机器人", enabled: false });
    await client.startBotInstance("bot-1");
    await client.stopBotInstance("bot-1");
    await client.deleteBotInstance("bot-1");

    expect(calls.map((config) => config.url)).toEqual([
      "/bot-admin/instances",
      "/bot-admin/instances",
      "/bot-admin/instances/bot-1",
      "/bot-admin/instances/bot-1/start",
      "/bot-admin/instances/bot-1/stop",
      "/bot-admin/instances/bot-1",
    ]);
    expect(calls.map((config) => config.method)).toEqual([
      "get",
      "post",
      "put",
      "post",
      "post",
      "delete",
    ]);
    expect(requestData(calls[1]!)).toEqual({
      platform: "mock",
      name: "测试机器人",
      platformConfig: {},
      defaultCharacterId: "character-1",
      autoStart: false,
    });
    expect(requestData(calls[2]!)).toEqual({ name: "客服机器人", enabled: false });
  });

  it("normalizes paginated MCP server responses", async () => {
    const { adapter } = createAdapter({
      items: [{ id: "mcp-1", name: "文件系统", enabled: true }],
      size: 1,
    });
    const client = new ApiClient({
      adapter,
      tokenProvider: () => null,
      clientIdProvider: () => "client-123",
    });

    await expect(client.fetchMcpServers()).resolves.toEqual([
      { id: "mcp-1", name: "文件系统", enabled: true },
    ]);
  });

  it("fetches workspace tree, children, and files with legacy endpoints", async () => {
    const { adapter, calls } = createAdapter({ tree: [] });
    const client = new ApiClient({
      adapter,
      tokenProvider: () => null,
      clientIdProvider: () => "client-123",
    });

    await client.fetchWorkspaceTree("session-1");
    await client.fetchWorkspaceChildren("session-1", "src/components");
    await client.fetchWorkspaceFile("session-1", "README.md");

    expect(calls.map((config) => config.url)).toEqual([
      "/sessions/session-1/workspace/tree",
      "/sessions/session-1/workspace/children",
      "/sessions/session-1/workspace/file",
    ]);
    expect(calls[1]?.params).toEqual({ path: "src/components" });
    expect(calls[2]?.params).toEqual({ path: "README.md" });
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
