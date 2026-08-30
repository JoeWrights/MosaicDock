import type {
  CreateSessionRequest,
  Character,
  CharacterGroup,
  CharacterListParams,
  CharacterListResponse,
  CharacterToolsResponse,
  CreateCharacterGroupRequest,
  CreateCharacterRequest,
  CreateTeamRequest,
  CreateKnowledgeBaseFolderRequest,
  CreateKnowledgeBaseRequest,
  LoginRequest,
  LoginResponse,
  KnowledgeBase,
  KnowledgeBaseFile,
  KnowledgeBaseFileListParams,
  KnowledgeBaseFileListResponse,
  KnowledgeBaseListParams,
  KnowledgeBaseListResponse,
  Message,
  FileAttachment,
  McpServer,
  ModelProvider,
  PaginatedResponse,
  RenameKnowledgeBaseFileRequest,
  Session,
  SessionListResponse,
  Team,
  TeamListResponse,
  UpdateCharacterGroupRequest,
  UpdateCharacterRequest,
  UpdateTeamRequest,
  UpdateKnowledgeBaseRequest,
  User,
} from "@mosaic-dock/shared";
import { getClientId } from "@mosaic-dock/shared";
import type { AxiosAdapter } from "axios";
import {
  createRestRequestClient,
  type RestRequestClient,
  type RestRequestOptions,
} from "./request";
import * as botAdminService from "./services/bot-admin-service";
import * as bootstrapService from "./services/bootstrap-service";
import * as characterService from "./services/character-service";
import * as knowledgeBaseService from "./services/knowledge-base-service";
import * as messageService from "./services/message-service";
import * as mcpServerService from "./services/mcp-server-service";
import * as modelService from "./services/model-service";
import * as sessionFileService from "./services/session-file-service";
import * as sessionService from "./services/session-service";
import * as workspaceService from "./services/workspace-service";

export interface ApiClientOptions {
  baseURL?: string;
  fetcher?: typeof fetch;
  adapter?: AxiosAdapter;
  tokenProvider?: () => string | null;
  clientIdProvider?: () => string;
}

export interface RequestOptions extends RestRequestOptions {
  body?: unknown;
}

export interface WorkspaceTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  hasChildren?: boolean;
  children?: WorkspaceTreeNode[];
}

export interface WorkspaceTreeResponse {
  tree: WorkspaceTreeNode[];
}

export interface WorkspaceChildrenResponse {
  children: WorkspaceTreeNode[];
}

export interface WorkspaceFileResponse {
  path: string;
  name: string;
  extension: string;
  size: number;
  content: string;
  mimeType: string;
}

export interface MessageContentToolDetails {
  toolCalls: unknown[];
  toolCallsResponse: unknown[];
}

export type SessionTokenStats = sessionService.SessionTokenStats;
export type SessionSummary = sessionService.SessionSummary;
export type CompressSessionResponse = sessionService.CompressSessionResponse;

export interface BotInstance {
  id: string;
  userId: string;
  platform: string;
  name: string;
  enabled: boolean;
  platformConfig: Record<string, unknown>;
  reconnectEnabled: boolean;
  maxRetries: number;
  retryInterval: number;
  defaultCharacterId: string;
  defaultModelId?: string | null;
  status: string;
  runtimeStatus?: string;
  lastStartedAt?: string | null;
  lastError?: string | null;
  additionalKwargs?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface BotConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "number" | "select" | "boolean";
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: { value: string; label: string }[];
  defaultValue?: unknown;
}

export interface BotPlatformMetadata {
  platform: string;
  displayName: string;
  icon?: string;
  description: string;
  fields: BotConfigField[];
}

export interface CreateBotInstanceRequest {
  platform: string;
  name: string;
  platformConfig: Record<string, unknown>;
  reconnectConfig?: {
    enabled?: boolean;
    maxRetries?: number;
    retryInterval?: number;
  };
  defaultCharacterId: string;
  defaultModelId?: string;
  additionalKwargs?: unknown;
  autoStart?: boolean;
}

export interface UpdateBotInstanceRequest {
  name?: string;
  platformConfig?: Record<string, unknown>;
  enabled?: boolean;
  reconnectConfig?: {
    enabled?: boolean;
    maxRetries?: number;
    retryInterval?: number;
  };
  defaultCharacterId?: string;
  defaultModelId?: string;
  additionalKwargs?: unknown;
}

export type TaskScheduleType = "cron" | "once";
export type TaskTargetMode = "new_session" | "existing_session";

export interface ScheduledTask {
  id: string;
  userId: string;
  name: string;
  prompt: string;
  scheduleType: TaskScheduleType;
  cronExpression: string;
  executeAt?: string | null;
  targetMode: TaskTargetMode;
  targetSessionId?: string | null;
  characterId?: string | null;
  modelId?: string | null;
  settings?: Record<string, unknown> | null;
  enabled: boolean;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
  maxExecutions?: number | null;
  executionCount?: number;
  maxRetries?: number;
  retryInterval?: number;
}

export type CreateScheduledTaskRequest = {
  name: string;
  prompt: string;
  scheduleType: TaskScheduleType;
  targetMode: TaskTargetMode;
  cronExpression?: string;
  executeAt?: string;
  targetSessionId?: string;
  characterId?: string;
  modelId?: string;
  settings?: Record<string, unknown>;
  enabled?: boolean;
  maxExecutions?: number;
  maxRetries?: number;
  retryInterval?: number;
};

export interface ScheduledTaskListResponse {
  items: ScheduledTask[];
  total: number;
}

export class ApiClient {
  private readonly baseURL: string;
  private readonly requestClient: RestRequestClient;

  constructor(options: ApiClientOptions = {}) {
    this.baseURL = options.baseURL ?? "/api/v1";
    this.requestClient = createRestRequestClient({
      baseURL: this.baseURL,
      adapter: options.adapter,
      tokenProvider: options.tokenProvider ?? defaultTokenProvider,
      clientIdProvider: options.clientIdProvider ?? getClientId,
    });
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.requestClient.request<T>(endpoint, options);
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>("/auth/login", {
      method: "POST",
      body: credentials,
    });
  }

  async autoLogin(): Promise<LoginResponse> {
    return bootstrapService.autoLogin<LoginResponse>(this.requestClient);
  }

  async getProfile(): Promise<User> {
    return this.request<User>("/user/profile");
  }

  async fetchModels(): Promise<PaginatedResponse<ModelProvider>> {
    return modelService.fetchModels(this.requestClient);
  }

  async fetchAllModels(): Promise<PaginatedResponse<ModelProvider>> {
    return modelService.fetchAllModels(this.requestClient);
  }

  async createProvider(data: modelService.CreateProviderRequest): Promise<ModelProvider> {
    return modelService.createProvider(this.requestClient, data);
  }

  async testProviderConnection(
    data: modelService.TestProviderConnectionRequest,
  ): Promise<modelService.ProviderConnectionTestResult> {
    return modelService.testProviderConnection(this.requestClient, data);
  }

  async updateProvider(
    providerId: string,
    data: modelService.UpdateProviderRequest,
  ): Promise<ModelProvider> {
    return modelService.updateProvider(this.requestClient, providerId, data);
  }

  async deleteProvider<T = { success: boolean }>(providerId: string): Promise<T> {
    return modelService.deleteProvider<T>(this.requestClient, providerId);
  }

  async fetchRemoteModels(providerId: string): Promise<PaginatedResponse<modelService.RemoteModel>> {
    return modelService.fetchRemoteModels(this.requestClient, providerId);
  }

  async createModel(data: modelService.ModelConfigRequest): Promise<import("@mosaic-dock/shared").Model> {
    return modelService.createModel(this.requestClient, data);
  }

  async updateModel(
    modelId: string,
    data: modelService.UpdateModelRequest,
  ): Promise<import("@mosaic-dock/shared").Model> {
    return modelService.updateModel(this.requestClient, modelId, data);
  }

  async deleteModel<T = { success: boolean }>(modelId: string): Promise<T> {
    return modelService.deleteModel<T>(this.requestClient, modelId);
  }

  async toggleModelFavorite(modelId: string): Promise<import("@mosaic-dock/shared").Model> {
    return modelService.toggleModelFavorite(this.requestClient, modelId);
  }

  async toggleModelActive(modelId: string): Promise<import("@mosaic-dock/shared").Model> {
    return modelService.toggleModelActive(this.requestClient, modelId);
  }

  async fetchSessionGroups<T = unknown>(): Promise<T> {
    return bootstrapService.fetchSessionGroups<T>(this.requestClient);
  }

  async createSessionGroup<T = unknown>(data: { name: string }): Promise<T> {
    return bootstrapService.createSessionGroup<T>(this.requestClient, data);
  }

  async updateSessionGroup<T = unknown>(groupId: string, data: { name: string }): Promise<T> {
    return bootstrapService.updateSessionGroup<T>(this.requestClient, groupId, data);
  }

  async deleteSessionGroup<T = unknown>(groupId: string): Promise<T> {
    return bootstrapService.deleteSessionGroup<T>(this.requestClient, groupId);
  }

  async reorderSessionGroups<T = unknown>(groupIds: string[]): Promise<T> {
    return bootstrapService.reorderSessionGroups<T>(this.requestClient, groupIds);
  }

  async fetchKnowledgeBases(
    params: KnowledgeBaseListParams = {},
  ): Promise<KnowledgeBaseListResponse> {
    return knowledgeBaseService.fetchKnowledgeBases(this.requestClient, params);
  }

  async createKnowledgeBase(data: CreateKnowledgeBaseRequest): Promise<KnowledgeBase> {
    return knowledgeBaseService.createKnowledgeBase(this.requestClient, data);
  }

  async updateKnowledgeBase(
    knowledgeBaseId: string,
    data: UpdateKnowledgeBaseRequest,
  ): Promise<KnowledgeBase> {
    return knowledgeBaseService.updateKnowledgeBase(this.requestClient, knowledgeBaseId, data);
  }

  async deleteKnowledgeBase<T = { success: boolean }>(knowledgeBaseId: string): Promise<T> {
    return knowledgeBaseService.deleteKnowledgeBase<T>(this.requestClient, knowledgeBaseId);
  }

  async fetchKnowledgeBaseFiles(
    knowledgeBaseId: string,
    params: KnowledgeBaseFileListParams = {},
  ): Promise<KnowledgeBaseFileListResponse> {
    return knowledgeBaseService.fetchKnowledgeBaseFiles(this.requestClient, knowledgeBaseId, params);
  }

  async uploadKnowledgeBaseFile(
    knowledgeBaseId: string,
    file: File,
    relativePath?: string,
  ): Promise<KnowledgeBaseFile> {
    return knowledgeBaseService.uploadKnowledgeBaseFile(
      this.requestClient,
      knowledgeBaseId,
      file,
      relativePath,
    );
  }

  async createKnowledgeBaseFolder(
    knowledgeBaseId: string,
    data: CreateKnowledgeBaseFolderRequest,
  ): Promise<KnowledgeBaseFile> {
    return knowledgeBaseService.createKnowledgeBaseFolder(this.requestClient, knowledgeBaseId, data);
  }

  async renameKnowledgeBaseFile(
    knowledgeBaseId: string,
    fileId: string,
    data: RenameKnowledgeBaseFileRequest,
  ): Promise<KnowledgeBaseFile> {
    return knowledgeBaseService.renameKnowledgeBaseFile(
      this.requestClient,
      knowledgeBaseId,
      fileId,
      data,
    );
  }

  async deleteKnowledgeBaseFile<T = { success: boolean }>(
    knowledgeBaseId: string,
    fileId: string,
  ): Promise<T> {
    return knowledgeBaseService.deleteKnowledgeBaseFile<T>(
      this.requestClient,
      knowledgeBaseId,
      fileId,
    );
  }

  async retryKnowledgeBaseFile<T = { success: boolean }>(
    knowledgeBaseId: string,
    fileId: string,
  ): Promise<T> {
    return knowledgeBaseService.retryKnowledgeBaseFile<T>(
      this.requestClient,
      knowledgeBaseId,
      fileId,
    );
  }

  async fetchSkills<T = unknown>(): Promise<T> {
    return bootstrapService.fetchSkills<T>(this.requestClient);
  }

  async triggerSkillScan<T = unknown>(): Promise<T> {
    return bootstrapService.triggerSkillScan<T>(this.requestClient);
  }

  async toggleSkill<T = unknown>(skillId: string, enabled: boolean): Promise<T> {
    return bootstrapService.toggleSkill<T>(this.requestClient, skillId, enabled);
  }

  async reloadSkill<T = unknown>(skillId: string): Promise<T> {
    return bootstrapService.reloadSkill<T>(this.requestClient, skillId);
  }

  async fetchSkillDocumentation<T = { content: string }>(skillId: string): Promise<T> {
    return bootstrapService.fetchSkillDocumentation<T>(this.requestClient, skillId);
  }

  async installSkill<T = { success: boolean; message?: string; skillId?: string }>(
    file: File,
    force = false,
  ): Promise<T> {
    return bootstrapService.installSkill<T>(this.requestClient, file, force);
  }

  async installSkillFromUrl<T = { success: boolean; message?: string; skillId?: string; skillIds?: string[] }>(
    url: string,
    force = false,
  ): Promise<T> {
    return bootstrapService.installSkillFromUrl<T>(this.requestClient, url, force);
  }

  async installSkillFromRegistry<T = { success: boolean; message?: string; skillId?: string; skillIds?: string[] }>(
    data: bootstrapService.InstallSkillFromRegistryRequest,
  ): Promise<T> {
    return bootstrapService.installSkillFromRegistry<T>(this.requestClient, data);
  }

  async uninstallSkill<T = { success: boolean; message?: string }>(skillId: string): Promise<T> {
    return bootstrapService.uninstallSkill<T>(this.requestClient, skillId);
  }

  async fetchAppearanceSettings<T = unknown>(): Promise<T> {
    return bootstrapService.fetchAppearanceSettings<T>(this.requestClient);
  }

  async fetchGroupSettings<T = Record<string, unknown>>(group: string): Promise<T> {
    return bootstrapService.fetchGroupSettings<T>(this.requestClient, group);
  }

  async updateGroupSettings<T = Record<string, unknown>>(
    group: string,
    data: Record<string, unknown>,
  ): Promise<T> {
    return bootstrapService.updateGroupSettings<T>(this.requestClient, group, data);
  }

  async uploadWallpaper<T = { url: string }>(file: File): Promise<T> {
    return bootstrapService.uploadWallpaper<T>(this.requestClient, file);
  }

  async deleteWallpaper<T = { success: boolean }>(): Promise<T> {
    return bootstrapService.deleteWallpaper<T>(this.requestClient);
  }

  async fetchGlobalPlugins<T = unknown>(): Promise<T> {
    return bootstrapService.fetchGlobalPlugins<T>(this.requestClient);
  }

  async updateGlobalPluginStatus<T = unknown>(
    pluginId: string,
    enabled: boolean,
  ): Promise<T> {
    return bootstrapService.updateGlobalPluginStatus<T>(this.requestClient, pluginId, enabled);
  }

  async fetchCharacters(params: CharacterListParams = {}): Promise<CharacterListResponse> {
    return characterService.fetchCharacters(this.requestClient, params);
  }

  async fetchCharacter(characterId: string): Promise<Character> {
    return characterService.fetchCharacter(this.requestClient, characterId);
  }

  async createCharacter(data: CreateCharacterRequest): Promise<Character> {
    return characterService.createCharacter(this.requestClient, data);
  }

  async updateCharacter(characterId: string, data: UpdateCharacterRequest): Promise<Character> {
    return characterService.updateCharacter(this.requestClient, characterId, data);
  }

  async deleteCharacter<T = { success: boolean }>(characterId: string): Promise<T> {
    return characterService.deleteCharacter<T>(this.requestClient, characterId);
  }

  async fetchCharacterGroups(): Promise<CharacterGroup[]> {
    return characterService.fetchCharacterGroups(this.requestClient);
  }

  async createCharacterGroup(data: CreateCharacterGroupRequest): Promise<CharacterGroup> {
    return characterService.createCharacterGroup(this.requestClient, data);
  }

  async updateCharacterGroup(
    groupId: string,
    data: UpdateCharacterGroupRequest,
  ): Promise<CharacterGroup> {
    return characterService.updateCharacterGroup(this.requestClient, groupId, data);
  }

  async deleteCharacterGroup<T = { success: boolean }>(groupId: string): Promise<T> {
    return characterService.deleteCharacterGroup<T>(this.requestClient, groupId);
  }

  async uploadCharacterAvatar(characterId: string, file: File): Promise<{ url: string }> {
    return characterService.uploadCharacterAvatar(this.requestClient, characterId, file);
  }

  async fetchCharacterTools(characterId: string): Promise<CharacterToolsResponse> {
    return characterService.fetchCharacterTools(this.requestClient, characterId);
  }

  async fetchMcpServers(): Promise<McpServer[]> {
    return mcpServerService.fetchMcpServers(this.requestClient);
  }

  async createMcpServer<T = McpServer>(data: Record<string, unknown>): Promise<T> {
    return mcpServerService.createMcpServer<T>(this.requestClient, data);
  }

  async toggleMcpServer<T = unknown>(serverId: string, enabled: boolean): Promise<T> {
    return mcpServerService.toggleMcpServer<T>(this.requestClient, serverId, enabled);
  }

  async refreshMcpServerTools<T = unknown>(serverId: string): Promise<T> {
    return mcpServerService.refreshMcpServerTools<T>(this.requestClient, serverId);
  }

  async fetchBotInstances(): Promise<BotInstance[]> {
    return botAdminService.fetchBotInstances(this.requestClient);
  }

  async fetchBotPlatforms(): Promise<BotPlatformMetadata[]> {
    return botAdminService.fetchBotPlatforms(this.requestClient);
  }

  async fetchScheduledTasks(): Promise<ScheduledTaskListResponse> {
    return this.request<ScheduledTaskListResponse>("/scheduler/tasks");
  }

  async fetchSchedulerCronPresets<T = unknown>(): Promise<T> {
    return this.request<T>("/scheduler/cron-presets");
  }

  async createScheduledTask(data: CreateScheduledTaskRequest): Promise<ScheduledTask> {
    return this.request<ScheduledTask>("/scheduler/tasks", {
      method: "POST",
      body: data,
    });
  }

  async createBotInstance(data: CreateBotInstanceRequest): Promise<BotInstance> {
    return botAdminService.createBotInstance(this.requestClient, data);
  }

  async updateBotInstance(botId: string, data: UpdateBotInstanceRequest): Promise<BotInstance> {
    return botAdminService.updateBotInstance(this.requestClient, botId, data);
  }

  async startBotInstance(botId: string): Promise<BotInstance> {
    return botAdminService.startBotInstance(this.requestClient, botId);
  }

  async stopBotInstance(botId: string): Promise<BotInstance> {
    return botAdminService.stopBotInstance(this.requestClient, botId);
  }

  async deleteBotInstance<T = { success: boolean }>(botId: string): Promise<T> {
    return botAdminService.deleteBotInstance<T>(this.requestClient, botId);
  }

  async fetchTeams(): Promise<TeamListResponse> {
    return characterService.fetchTeams(this.requestClient);
  }

  async createTeam(data: CreateTeamRequest): Promise<Team> {
    return characterService.createTeam(this.requestClient, data);
  }

  async updateTeam(teamId: string, data: UpdateTeamRequest): Promise<Team> {
    return characterService.updateTeam(this.requestClient, teamId, data);
  }

  async deleteTeam<T = { success: boolean }>(teamId: string): Promise<T> {
    return characterService.deleteTeam<T>(this.requestClient, teamId);
  }

  async createSession(data: CreateSessionRequest): Promise<Session> {
    return sessionService.createSession(this.requestClient, data);
  }

  async fetchSession(sessionId: string): Promise<Session> {
    return sessionService.fetchSession(this.requestClient, sessionId);
  }

  async updateSession<T = Session>(sessionId: string, data: Partial<Session>): Promise<T> {
    return sessionService.updateSession<T>(this.requestClient, sessionId, data);
  }

  async deleteSession<T = { success: boolean }>(
    sessionId: string,
    options: { deleteWorkspace?: boolean } = {},
  ): Promise<T> {
    return sessionService.deleteSession<T>(this.requestClient, sessionId, options);
  }

  async fetchSessions(params: {
    skip?: number;
    limit?: number;
    groupId?: string | null;
  } = {}): Promise<SessionListResponse> {
    return sessionService.fetchSessions(this.requestClient, params);
  }

  async fetchSessionMessages(
    sessionId: string,
    options: {
      limit?: number;
      beforeMessageId?: string;
      afterMessageId?: string;
    } = {},
  ): Promise<PaginatedResponse<Message>> {
    return sessionService.fetchSessionMessages(this.requestClient, sessionId, options);
  }

  async fetchSessionTokenStats(sessionId: string): Promise<sessionService.SessionTokenStats> {
    return sessionService.fetchSessionTokenStats(this.requestClient, sessionId);
  }

  async fetchSessionSummaries(sessionId: string): Promise<sessionService.SessionSummary[]> {
    return sessionService.fetchSessionSummaries(this.requestClient, sessionId);
  }

  async compressSession(sessionId: string): Promise<sessionService.CompressSessionResponse> {
    return sessionService.compressSession(this.requestClient, sessionId);
  }

  async updateSummary(
    summaryId: string,
    data: { summaryContent?: string },
  ): Promise<sessionService.SessionSummary> {
    return sessionService.updateSummary(this.requestClient, summaryId, data);
  }

  async deleteSummary<T = { success: boolean }>(summaryId: string): Promise<T> {
    return sessionService.deleteSummary<T>(this.requestClient, summaryId);
  }

  async fetchWorkspaceTree(sessionId: string): Promise<WorkspaceTreeResponse> {
    return workspaceService.fetchWorkspaceTree(this.requestClient, sessionId);
  }

  async fetchWorkspaceChildren(
    sessionId: string,
    path: string,
  ): Promise<WorkspaceChildrenResponse> {
    return workspaceService.fetchWorkspaceChildren(this.requestClient, sessionId, path);
  }

  async fetchWorkspaceFile(
    sessionId: string,
    path: string,
  ): Promise<WorkspaceFileResponse> {
    return workspaceService.fetchWorkspaceFile(this.requestClient, sessionId, path);
  }

  async createMessage(
    sessionId: string,
    content: string,
    files: unknown[] = [],
    replaceMessageId: string | null = null,
    knowledgeBaseIds?: string[],
  ): Promise<Message> {
    return messageService.createMessage(
      this.requestClient,
      sessionId,
      content,
      files,
      replaceMessageId,
      knowledgeBaseIds,
    );
  }

  async uploadSessionFile(sessionId: string, file: File): Promise<FileAttachment> {
    return sessionFileService.uploadSessionFile(this.requestClient, sessionId, file);
  }

  async updateMessage<T = Message>(messageId: string, data: Record<string, unknown>): Promise<T> {
    return messageService.updateMessage<T>(this.requestClient, messageId, data);
  }

  async deleteMessage<T = { success: boolean }>(messageId: string): Promise<T> {
    return messageService.deleteMessage<T>(this.requestClient, messageId);
  }

  async updateMessageActiveContent<T = { success: boolean }>(
    contentId: string,
    messageId: string,
  ): Promise<T> {
    return messageService.updateMessageActiveContent<T>(this.requestClient, contentId, messageId);
  }

  async fetchMessageContentToolDetails(
    contentId: string,
  ): Promise<MessageContentToolDetails> {
    return messageService.fetchMessageContentToolDetails(this.requestClient, contentId);
  }

  getBaseURL(): string {
    return this.baseURL;
  }
}

function defaultTokenProvider(): string | null {
  if (typeof sessionStorage !== "undefined") {
    const sessionToken = sessionStorage.getItem("token");
    if (sessionToken) return sessionToken;
  }

  if (typeof localStorage !== "undefined") {
    return localStorage.getItem("token");
  }

  return null;
}
