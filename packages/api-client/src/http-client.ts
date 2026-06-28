import type {
  CreateSessionRequest,
  Character,
  CharacterGroup,
  CharacterListParams,
  CharacterListResponse,
  CharacterToolsResponse,
  CreateCharacterGroupRequest,
  CreateCharacterRequest,
  LoginRequest,
  LoginResponse,
  Message,
  ModelProvider,
  PaginatedResponse,
  Session,
  SessionListResponse,
  UpdateCharacterGroupRequest,
  UpdateCharacterRequest,
  User,
} from "@mosaic-dock/shared";
import { getClientId } from "@mosaic-dock/shared";
import type { AxiosAdapter } from "axios";
import {
  createRestRequestClient,
  type RestRequestClient,
  type RestRequestOptions,
} from "./request";
import * as bootstrapService from "./services/bootstrap-service";
import * as characterService from "./services/character-service";
import * as messageService from "./services/message-service";
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

  async fetchKnowledgeBases<T = unknown>(): Promise<T> {
    return bootstrapService.fetchKnowledgeBases<T>(this.requestClient);
  }

  async fetchSkills<T = unknown>(): Promise<T> {
    return bootstrapService.fetchSkills<T>(this.requestClient);
  }

  async fetchAppearanceSettings<T = unknown>(): Promise<T> {
    return bootstrapService.fetchAppearanceSettings<T>(this.requestClient);
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
