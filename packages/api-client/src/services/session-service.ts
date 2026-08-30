import type {
  CreateSessionRequest,
  Message,
  PaginatedResponse,
  Session,
  SessionListResponse,
} from "@mosaic-dock/shared";
import type { RestRequestClient } from "../request";

export interface SessionTokenStats {
  usedTokens: number;
  totalTokens: number;
  remainingTokens: number;
  percentage: number;
  modelName: string;
  messageCount: number;
}

export interface SessionSummary {
  id: string;
  sessionId?: string;
  summaryContent?: string | null;
  compressionStats?: {
    beforeTokenCount?: number;
    afterTokenCount?: number;
    beforeMessageCount?: number;
    afterMessageCount?: number;
  } | null;
  pruningMetadata?: Record<string, unknown> | null;
  cleaningStrategy?: string | null;
  createdAt?: string;
}

export interface CompressSessionResponse {
  success: boolean;
  message?: string;
  before?: {
    tokenCount?: number;
    messageCount?: number;
    contextWindow?: number;
  };
  after?: {
    tokenCount?: number;
    messageCount?: number;
    compressionRatio?: string;
  };
  strategy?: string;
  modelName?: string;
}

export function createSession(
  request: RestRequestClient,
  data: CreateSessionRequest,
): Promise<Session> {
  return request.request<Session>("/sessions", {
    method: "POST",
    body: data,
  });
}

export function fetchSession(request: RestRequestClient, sessionId: string): Promise<Session> {
  return request.request<Session>(`/sessions/${sessionId}`);
}

export function updateSession<T = Session>(
  request: RestRequestClient,
  sessionId: string,
  data: Partial<Session>,
): Promise<T> {
  return request.request<T>(`/sessions/${sessionId}`, {
    method: "PUT",
    body: data,
  });
}

export function deleteSession<T = { success: boolean }>(
  request: RestRequestClient,
  sessionId: string,
  options: { deleteWorkspace?: boolean } = {},
): Promise<T> {
  return request.request<T>(`/sessions/${sessionId}`, {
    method: "DELETE",
    params: options.deleteWorkspace ? { deleteWorkspace: true } : undefined,
  });
}

export function fetchSessions(
  request: RestRequestClient,
  params: {
    skip?: number;
    limit?: number;
    groupId?: string | null;
  } = {},
): Promise<SessionListResponse> {
  const query: Record<string, string> = {};
  if (params.skip !== undefined) query.skip = String(params.skip);
  if (params.limit !== undefined) query.limit = String(params.limit);
  if (params.groupId !== undefined) {
    query.groupId = params.groupId === null ? "null" : params.groupId;
  }

  return request.request<SessionListResponse>("/sessions", {
    params: Object.keys(query).length > 0 ? query : undefined,
  });
}

export function fetchSessionMessages(
  request: RestRequestClient,
  sessionId: string,
  options: {
    limit?: number;
    beforeMessageId?: string;
    afterMessageId?: string;
  } = {},
): Promise<PaginatedResponse<Message>> {
  const params: Record<string, string> = {};
  if (options.limit !== undefined) params.limit = String(options.limit);
  if (options.beforeMessageId) params.beforeMessageId = options.beforeMessageId;
  if (options.afterMessageId) params.afterMessageId = options.afterMessageId;

  return request.request<PaginatedResponse<Message>>(`/sessions/${sessionId}/messages`, {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
}

export function fetchSessionTokenStats(
  request: RestRequestClient,
  sessionId: string,
): Promise<SessionTokenStats> {
  return request.request<SessionTokenStats>(`/sessions/${sessionId}/token-stats`);
}

export function fetchSessionSummaries(
  request: RestRequestClient,
  sessionId: string,
): Promise<SessionSummary[]> {
  return request.request<SessionSummary[]>(`/sessions/${sessionId}/summaries`);
}

export function compressSession(
  request: RestRequestClient,
  sessionId: string,
): Promise<CompressSessionResponse> {
  return request.request<CompressSessionResponse>(`/sessions/${sessionId}/compress`, {
    method: "POST",
  });
}

export function updateSummary(
  request: RestRequestClient,
  summaryId: string,
  data: { summaryContent?: string },
): Promise<SessionSummary> {
  return request.request<SessionSummary>(`/sessions/summaries/${summaryId}`, {
    method: "PUT",
    body: data,
  });
}

export function deleteSummary<T = { success: boolean }>(
  request: RestRequestClient,
  summaryId: string,
): Promise<T> {
  return request.request<T>(`/sessions/summaries/${summaryId}`, {
    method: "DELETE",
  });
}
