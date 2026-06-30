import type { ISODateString } from "./common";

export type CharacterType = "private" | "public" | "system";

export interface CharacterGroup {
  id: string;
  name: string;
  userId: string;
  sortOrder: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface CharacterSettings {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  assistantName?: string;
  assistantIdentity?: string;
  systemPrompt?: string;
  memoryType?: string;
  modelTemperature?: number | null;
  modelTopP?: number | null;
  modelFrequencyPenalty?: number | null;
  overrideModelParams?: boolean;
  useUserPrompt?: boolean;
  memory?: CharacterMemorySettings;
  tools?: CharacterToolsConfig;
  mcpServers?: CharacterMcpServersConfig;
  skills?: CharacterSkillsConfig;
  [key: string]: unknown;
}

export interface CharacterMemorySettings {
  maxMemoryLength?: number | null;
  compressionTriggerRatio?: number;
  compressionTargetRatio?: number;
  summaryMode?: "disabled" | "fast" | "memory_sync";
  maxTokensLimit?: number | null;
}

export type CharacterToolPluginConfig = boolean | string[];
export type CharacterToolsConfig = boolean | Record<string, CharacterToolPluginConfig>;
export type CharacterMcpServersConfig = boolean | string[];
export type CharacterSkillsConfig = boolean | Record<string, boolean>;

export interface Character {
  id: string;
  title: string;
  description?: string;
  avatarUrl?: string;
  modelId?: string | null;
  userId: string;
  type: CharacterType;
  isPublic?: boolean;
  isActive: boolean;
  groupId?: string | null;
  group?: CharacterGroup | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  settings?: CharacterSettings;
}

export interface CharacterListParams {
  skip?: number;
  limit?: number;
  groupId?: string | null;
}

export interface CreateCharacterRequest {
  title: string;
  description?: string;
  avatarUrl?: string | null;
  groupId?: string | null;
  modelId?: string | null;
  settings?: CharacterSettings;
}

export type UpdateCharacterRequest = Partial<CreateCharacterRequest> & {
  isActive?: boolean;
};

export interface CreateCharacterGroupRequest {
  name: string;
}

export type UpdateCharacterGroupRequest = Partial<CreateCharacterGroupRequest>;

export interface CharacterToolDefinition {
  name: string;
  displayName?: string;
  description?: string;
  enabled?: boolean;
  parameters?: unknown;
}

export interface CharacterPluginDefinition {
  pluginId: string;
  displayName: string;
  description?: string;
  enabled?: boolean;
  effective?: string;
  effectiveEnabled?: boolean;
  isMcp?: boolean;
  isSkill?: boolean;
  tools?: CharacterToolDefinition[];
}

export interface CharacterToolsResponse {
  characterId: string;
  plugins: CharacterPluginDefinition[];
}

export interface CharacterListResponse {
  items: Character[];
  total: number;
  page: number;
  pageSize: number;
}

export type TeamMemberRole = "leader" | "member";

export interface TeamMember {
  id: string;
  teamId?: string;
  characterId: string;
  role: TeamMemberRole;
  sortOrder?: number;
  character?: Pick<Character, "id" | "title" | "description" | "avatarUrl"> | null;
  characterSnapshot?: {
    title?: string;
    description?: string;
    avatarUrl?: string;
  } | null;
}

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  leaderCharacterId: string;
  leader?: Pick<Character, "id" | "title" | "description" | "avatarUrl"> | null;
  members?: TeamMember[];
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
}

export interface TeamListResponse {
  items: Team[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
  avatarUrl?: string | null;
  leaderCharacterId: string;
  memberCharacterIds?: string[];
  settings?: Record<string, unknown>;
}

export type UpdateTeamRequest = Partial<CreateTeamRequest>;
