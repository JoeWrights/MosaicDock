import type { ISODateString, PaginatedResponse } from "./common";

export type KnowledgeBaseFileStatus = "pending" | "processing" | "completed" | "failed";

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string | null;
  embeddingModelId: string;
  userId: string;
  chunkMaxSize?: number;
  chunkOverlapSize?: number;
  chunkMinSize?: number;
  isPublic?: boolean;
  metadataConfig?: unknown;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface KnowledgeBaseListParams {
  skip?: number;
  limit?: number;
}

export interface CreateKnowledgeBaseRequest {
  name: string;
  embeddingModelId: string;
  description?: string | null;
  chunkMaxSize?: number;
  chunkOverlapSize?: number;
  chunkMinSize?: number;
  isPublic?: boolean;
  metadataConfig?: unknown;
}

export type UpdateKnowledgeBaseRequest = Partial<CreateKnowledgeBaseRequest>;

export type KnowledgeBaseListResponse = PaginatedResponse<KnowledgeBase>;

export interface KnowledgeBaseFile {
  id: string;
  knowledgeBaseId: string;
  displayName: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  fileExtension?: string;
  processingStatus?: KnowledgeBaseFileStatus | string;
  progressPercentage?: number;
  currentStep?: string | null;
  errorMessage?: string | null;
  totalChunks?: number;
  isDirectory?: boolean;
  parentFolderId?: string | null;
  relativePath?: string | null;
  uploadedAt?: ISODateString;
  processedAt?: ISODateString | null;
}

export interface KnowledgeBaseFileListParams {
  skip?: number;
  limit?: number;
  parentFolderId?: string | null;
}

export type KnowledgeBaseFileListResponse = PaginatedResponse<KnowledgeBaseFile>;

export interface CreateKnowledgeBaseFolderRequest {
  folderName: string;
  parentFolderId?: string | null;
}

export interface RenameKnowledgeBaseFileRequest {
  newName: string;
}
