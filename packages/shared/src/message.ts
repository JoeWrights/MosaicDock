import type { ISODateString } from "./common";

export type MessageRole = "user" | "assistant";

export interface MessageState {
  isStreaming: boolean;
  isThinking?: boolean;
}

export interface FileAttachment {
  id?: string;
  name?: string;
  fileName?: string;
  displayName?: string;
  url?: string;
  previewUrl?: string | null;
  type?: string;
  fileType?: string;
  fileExtension?: string;
  size?: number;
  fileSize?: number;
  file?: File;
  content?: string | null;
  fileMetadata?: Record<string, unknown> | null;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
  [key: string]: unknown;
}

export interface MessageContent {
  id: string;
  content: string | null;
  reasoningContent?: string | null;
  turnsId?: string;
  additionalKwargs?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
  thinkingStartedAt?: number | null;
  thinkingDurationMs?: number | null;
  state: MessageState;
  isCurrent?: boolean;
}

export interface Message {
  id: string;
  role: MessageRole;
  contents: MessageContent[];
  parentId?: string;
  currentTurnsId?: string;
  state: MessageState;
  createdAt?: ISODateString;
  files?: FileAttachment[];
  index?: number;
}

export type MessagePair = [Message] | [Message, Message];
