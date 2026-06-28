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
  [key: string]: unknown;
}

export interface Character {
  id: string;
  title: string;
  description?: string;
  systemPrompt?: string;
  avatarUrl?: string;
  userId: string;
  type: CharacterType;
  isActive: boolean;
  groupId?: string | null;
  group?: CharacterGroup | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  settings?: CharacterSettings;
}

export interface CharacterListResponse {
  items: Character[];
  total: number;
  page: number;
  pageSize: number;
}
