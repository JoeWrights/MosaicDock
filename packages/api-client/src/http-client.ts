import type {
  CreateSessionRequest,
  Character,
  CharacterGroup,
  CharacterListParams,
  CharacterListResponse,
  CharacterToolsResponse,
  CreateCharacterGroupRequest,
  CreateCharacterRequest,
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
  McpServer,
  ModelProvider,
  PaginatedResponse,
  RenameKnowledgeBaseFileRequest,
  Session,
  SessionListResponse,
  UpdateCharacterGroupRequest,
  UpdateCharacterRequest,
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

export interface MessageContentToolDetails {
  toolCalls: unknown[];
  toolCallsResponse: unknown[];
}

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

  async getProfile(): Promise<User> {
    return this.request<User>("/user/profile");
  }

  async fetchModels(): Promise<PaginatedResponse<ModelProvider>> {
    return modelService.fetchModels(this.requestClient);
  }

  async fetchAllModels(): Promise<PaginatedResponse<ModelProvider>> {
    return modelService.fetchAllModels(this.requestClient);
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

  async fetchAppearanceSettings<T = unknown>(): Promise<T> {
    return bootstrapService.fetchAppearanceSettings<T>(this.requestClient);
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

  async toggleMcpServer<T = unknown>(serverId: string, enabled: boolean): Promise<T> {
    return mcpServerService.toggleMcpServer<T>(this.requestClient, serverId, enabled);
  }

  async refreshMcpServerTools<T = unknown>(serverId: string): Promise<T> {
    return mcpServerService.refreshMcpServerTools<T>(this.requestClient, serverId);
  }

  async fetchBotInstances(): Promise<BotInstance[]> {
    return botAdminService.fetchBotInstances(this.requestClient);
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

  async fetchTeams<T = unknown>(): Promise<T> {
    return bootstrapService.fetchTeams<T>(this.requestClient);
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

  async fetchWorkspaceTree(sessionId: string): Promise<WorkspaceTreeResponse> {
    return workspaceService.fetchWorkspaceTree(this.requestClient, sessionId);
  }

  async fetchWorkspaceChildren(
    sessionId: string,
    path: string,
  ): Promise<WorkspaceChildrenResponse> {
    return workspaceService.fetchWorkspaceChildren(this.requestClient, sessionId, path);
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
