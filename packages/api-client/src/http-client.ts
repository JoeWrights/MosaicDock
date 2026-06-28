import type {
  CreateSessionRequest,
  LoginRequest,
  LoginResponse,
  Message,
  ModelProvider,
  PaginatedResponse,
  Session,
  SessionListResponse,
  User,
} from "@mosaic-dock/shared";
import { getClientId } from "@mosaic-dock/shared";

export interface ApiClientOptions {
  baseURL?: string;
  fetcher?: typeof fetch;
  tokenProvider?: () => string | null;
  clientIdProvider?: () => string;
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
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

export class ApiClient {
  private readonly baseURL: string;
  private readonly fetcher: typeof fetch;
  private readonly tokenProvider: () => string | null;
  private readonly clientIdProvider: () => string;

  constructor(options: ApiClientOptions = {}) {
    this.baseURL = options.baseURL ?? "/api/v1";
    this.fetcher = options.fetcher ?? fetch.bind(globalThis);
    this.tokenProvider = options.tokenProvider ?? defaultTokenProvider;
    this.clientIdProvider = options.clientIdProvider ?? getClientId;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const token = this.tokenProvider();
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Client-Id", this.clientIdProvider());

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await this.fetcher(this.toUrl(endpoint), {
      ...options,
      headers,
      body:
        options.body === undefined || typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body),
    });

    return this.parseResponse<T>(response);
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
    return this.request<PaginatedResponse<ModelProvider>>("/models");
  }

  async fetchAllModels(): Promise<PaginatedResponse<ModelProvider>> {
    return this.request<PaginatedResponse<ModelProvider>>("/models/all");
  }

  async fetchSessionGroups<T = unknown>(): Promise<T> {
    return this.request<T>("/session-groups");
  }

  async createSessionGroup<T = unknown>(data: { name: string }): Promise<T> {
    return this.request<T>("/session-groups", {
      method: "POST",
      body: data,
    });
  }

  async updateSessionGroup<T = unknown>(groupId: string, data: { name: string }): Promise<T> {
    return this.request<T>(`/session-groups/${groupId}`, {
      method: "PUT",
      body: data,
    });
  }

  async deleteSessionGroup<T = unknown>(groupId: string): Promise<T> {
    return this.request<T>(`/session-groups/${groupId}`, {
      method: "DELETE",
    });
  }

  async reorderSessionGroups<T = unknown>(groupIds: string[]): Promise<T> {
    return this.request<T>("/session-groups/reorder", {
      method: "POST",
      body: { groupIds },
    });
  }

  async fetchKnowledgeBases<T = unknown>(): Promise<T> {
    return this.request<T>("/knowledge-bases");
  }

  async fetchSkills<T = unknown>(): Promise<T> {
    return this.request<T>("/skills");
  }

  async fetchAppearanceSettings<T = unknown>(): Promise<T> {
    return this.request<T>("/settings/appearance");
  }

  async fetchCharacters<T = unknown>(): Promise<T> {
    return this.request<T>("/characters");
  }

  async fetchTeams<T = unknown>(): Promise<T> {
    return this.request<T>("/teams");
  }

  async createSession(data: CreateSessionRequest): Promise<Session> {
    return this.request<Session>("/sessions", {
      method: "POST",
      body: data,
    });
  }

  async fetchSession(sessionId: string): Promise<Session> {
    return this.request<Session>(`/sessions/${sessionId}`);
  }

  async updateSession<T = Session>(sessionId: string, data: Partial<Session>): Promise<T> {
    return this.request<T>(`/sessions/${sessionId}`, {
      method: "PUT",
      body: data,
    });
  }

  async deleteSession<T = { success: boolean }>(
    sessionId: string,
    options: { deleteWorkspace?: boolean } = {},
  ): Promise<T> {
    const endpoint = options.deleteWorkspace
      ? `/sessions/${sessionId}?deleteWorkspace=true`
      : `/sessions/${sessionId}`;
    return this.request<T>(endpoint, {
      method: "DELETE",
    });
  }

  async fetchSessions(params: {
    skip?: number;
    limit?: number;
    groupId?: string | null;
  } = {}): Promise<SessionListResponse> {
    const search = new URLSearchParams();
    if (params.skip !== undefined) search.set("skip", String(params.skip));
    if (params.limit !== undefined) search.set("limit", String(params.limit));
    if (params.groupId !== undefined) {
      search.set("groupId", params.groupId === null ? "null" : params.groupId);
    }

    const query = search.toString();
    return this.request<SessionListResponse>(query ? `/sessions?${query}` : "/sessions");
  }

  async fetchSessionMessages(
    sessionId: string,
    options: {
      limit?: number;
      beforeMessageId?: string;
      afterMessageId?: string;
    } = {},
  ): Promise<PaginatedResponse<Message>> {
    const search = new URLSearchParams();
    if (options.limit !== undefined) search.set("limit", String(options.limit));
    if (options.beforeMessageId) {
      search.set("beforeMessageId", options.beforeMessageId);
    }
    if (options.afterMessageId) {
      search.set("afterMessageId", options.afterMessageId);
    }

    const query = search.toString();
    return this.request<PaginatedResponse<Message>>(
      query
        ? `/sessions/${sessionId}/messages?${query}`
        : `/sessions/${sessionId}/messages`,
    );
  }

  async fetchWorkspaceTree(sessionId: string): Promise<WorkspaceTreeResponse> {
    return this.request<WorkspaceTreeResponse>(`/sessions/${sessionId}/workspace/tree`);
  }

  async fetchWorkspaceChildren(
    sessionId: string,
    path: string,
  ): Promise<WorkspaceChildrenResponse> {
    const search = new URLSearchParams({ path });
    return this.request<WorkspaceChildrenResponse>(
      `/sessions/${sessionId}/workspace/children?${search.toString()}`,
    );
  }

  async createMessage(
    sessionId: string,
    content: string,
    files: unknown[] = [],
    replaceMessageId: string | null = null,
    knowledgeBaseIds?: string[],
  ): Promise<Message> {
    return this.request<Message>(`/sessions/${sessionId}/messages`, {
      method: "POST",
      body: {
        content,
        files,
        replaceMessageId,
        knowledgeBaseIds,
      },
    });
  }

  getBaseURL(): string {
    return this.baseURL;
  }

  private toUrl(endpoint: string): string {
    const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    return `${this.baseURL}${normalizedEndpoint}`;
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("content-type") ?? "";
    const hasJson = contentType.includes("application/json");
    const payload = hasJson ? await response.json() : await response.text();

    if (!response.ok) {
      const message =
        typeof payload === "object" && payload !== null
          ? extractErrorMessage(payload as Record<string, unknown>)
          : String(payload || `请求失败：${response.status}`);
      throw new Error(message);
    }

    return payload as T;
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

function extractErrorMessage(payload: Record<string, unknown>): string {
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.error === "string") return payload.error;
  if (
    typeof payload.message === "object" &&
    payload.message !== null &&
    "error" in payload.message
  ) {
    return String((payload.message as { error: unknown }).error);
  }
  return "请求失败";
}
