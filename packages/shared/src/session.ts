import type { ISODateString } from "./common";
import type { Character } from "./character";

export interface SessionSettings {
  thinkingEffort?: string;
  maxMemoryLength?: number;
  systemPrompt?: string;
  [key: string]: unknown;
}

export interface SessionModel {
  id: string;
  modelName: string;
  providerId?: string;
}

export interface Session {
  id: string;
  title: string;
  character?: Character;
  characterId: string;
  teamId?: string;
  modelId: string;
  model?: SessionModel;
  userId: string;
  settings: SessionSettings;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  lastActiveAt?: ISODateString;
  avatarUrl?: string;
  sessionType?: string;
  botId?: string;
  platform?: string;
  externalId?: string;
  workspacePath?: string | null;
  groupId?: string | null;
  isStreaming?: boolean;
  subSessions?: Session[];
}

export interface CreateSessionRequest {
  characterId?: string;
  teamId?: string;
  modelId?: string;
  title?: string;
  settings?: Partial<SessionSettings>;
  workspacePath?: string | null;
  groupId?: string | null;
}

export interface SessionGroup {
  id: string;
  name: string;
  userId: string;
  sortOrder: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface SessionListResponse {
  items: Session[];
  total: number;
  page: number;
  pageSize: number;
  hasMore?: boolean;
}
