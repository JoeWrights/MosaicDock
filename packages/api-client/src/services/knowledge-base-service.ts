import type {
  CreateKnowledgeBaseFolderRequest,
  CreateKnowledgeBaseRequest,
  KnowledgeBase,
  KnowledgeBaseFile,
  KnowledgeBaseFileListParams,
  KnowledgeBaseFileListResponse,
  KnowledgeBaseListParams,
  KnowledgeBaseListResponse,
  RenameKnowledgeBaseFileRequest,
  UpdateKnowledgeBaseRequest,
} from "@mosaic-dock/shared";
import type { RestRequestClient } from "../request";

export function fetchKnowledgeBases(
  request: RestRequestClient,
  params: KnowledgeBaseListParams = {},
): Promise<KnowledgeBaseListResponse> {
  return request.request<KnowledgeBaseListResponse>("/knowledge-bases", {
    params: normalizeListParams(params),
  });
}

export function createKnowledgeBase(
  request: RestRequestClient,
  data: CreateKnowledgeBaseRequest,
): Promise<KnowledgeBase> {
  return request.request<KnowledgeBase>("/knowledge-bases", {
    method: "POST",
    body: data,
  });
}

export function updateKnowledgeBase(
  request: RestRequestClient,
  knowledgeBaseId: string,
  data: UpdateKnowledgeBaseRequest,
): Promise<KnowledgeBase> {
  return request.request<KnowledgeBase>(`/knowledge-bases/${knowledgeBaseId}`, {
    method: "PUT",
    body: normalizeUpdateKnowledgeBaseRequest(data),
  });
}

export function deleteKnowledgeBase<T = { success: boolean }>(
  request: RestRequestClient,
  knowledgeBaseId: string,
): Promise<T> {
  return request.request<T>(`/knowledge-bases/${knowledgeBaseId}`, {
    method: "DELETE",
  });
}

export function fetchKnowledgeBaseFiles(
  request: RestRequestClient,
  knowledgeBaseId: string,
  params: KnowledgeBaseFileListParams = {},
): Promise<KnowledgeBaseFileListResponse> {
  const { parentFolderId, ...listParams } = params;
  if (parentFolderId !== undefined) {
    return request.request<KnowledgeBaseFileListResponse>(
      `/knowledge-bases/${knowledgeBaseId}/files/by-parent`,
      {
        params: {
          ...normalizeListParams(listParams),
          parentFolderId,
        },
      },
    );
  }

  return request.request<KnowledgeBaseFileListResponse>(`/knowledge-bases/${knowledgeBaseId}/files`, {
    params: normalizeListParams(listParams),
  });
}

export function uploadKnowledgeBaseFile(
  request: RestRequestClient,
  knowledgeBaseId: string,
  file: File,
  relativePath?: string,
): Promise<KnowledgeBaseFile> {
  const body = new FormData();
  body.append("file", file);
  if (relativePath) body.append("relativePath", relativePath);

  return request.request<KnowledgeBaseFile>(`/knowledge-bases/${knowledgeBaseId}/files/upload`, {
    method: "POST",
    body,
  });
}

export function createKnowledgeBaseFolder(
  request: RestRequestClient,
  knowledgeBaseId: string,
  data: CreateKnowledgeBaseFolderRequest,
): Promise<KnowledgeBaseFile> {
  return request.request<KnowledgeBaseFile>(`/knowledge-bases/${knowledgeBaseId}/files/folder`, {
    method: "POST",
    body: data,
  });
}

export function renameKnowledgeBaseFile(
  request: RestRequestClient,
  knowledgeBaseId: string,
  fileId: string,
  data: RenameKnowledgeBaseFileRequest,
): Promise<KnowledgeBaseFile> {
  return request.request<KnowledgeBaseFile>(
    `/knowledge-bases/${knowledgeBaseId}/files/${fileId}/rename`,
    {
      method: "POST",
      body: data,
    },
  );
}

export function deleteKnowledgeBaseFile<T = { success: boolean }>(
  request: RestRequestClient,
  knowledgeBaseId: string,
  fileId: string,
): Promise<T> {
  return request.request<T>(`/knowledge-bases/${knowledgeBaseId}/files/${fileId}`, {
    method: "DELETE",
  });
}

export function retryKnowledgeBaseFile<T = { success: boolean }>(
  request: RestRequestClient,
  knowledgeBaseId: string,
  fileId: string,
): Promise<T> {
  return request.request<T>(`/knowledge-bases/${knowledgeBaseId}/files/${fileId}/retry`, {
    method: "POST",
  });
}

function normalizeListParams(params: KnowledgeBaseListParams) {
  return {
    ...(typeof params.skip === "number" ? { skip: params.skip } : {}),
    ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
  };
}

function normalizeUpdateKnowledgeBaseRequest(data: UpdateKnowledgeBaseRequest) {
  return {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.embeddingModelId !== undefined ? { embedding_model_id: data.embeddingModelId } : {}),
    ...(data.chunkMaxSize !== undefined ? { chunk_max_size: data.chunkMaxSize } : {}),
    ...(data.chunkOverlapSize !== undefined ? { chunk_overlap_size: data.chunkOverlapSize } : {}),
    ...(data.chunkMinSize !== undefined ? { chunk_min_size: data.chunkMinSize } : {}),
    ...(data.isPublic !== undefined ? { is_public: data.isPublic } : {}),
    ...(data.metadataConfig !== undefined ? { metadata_config: data.metadataConfig } : {}),
  };
}
