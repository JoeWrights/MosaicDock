import type { Model, ModelProvider, PaginatedResponse } from "@mosaic-dock/shared";
import type { RestRequestClient } from "../request";

export interface ProviderHeadersAttributes {
  headers?: Record<string, string>;
}

export interface CreateProviderRequest {
  name: string;
  provider?: string;
  protocol: string;
  apiKey: string;
  apiUrl: string;
  attributes?: ProviderHeadersAttributes;
}

export interface TestProviderConnectionRequest {
  provider?: string;
  protocol: string;
  apiKey: string;
  apiUrl: string;
  attributes?: ProviderHeadersAttributes;
}

export interface ProviderConnectionTestResult {
  success: boolean;
  message?: string;
}

export interface UpdateProviderRequest {
  name?: string;
  protocol?: string;
  apiKey?: string;
  apiUrl?: string;
  avatarUrl?: string;
  attributes?: ProviderHeadersAttributes;
}

export interface ModelConfigRequest {
  providerId: string;
  modelName: string;
  modelType: string;
  config?: Record<string, unknown>;
}

export interface UpdateModelRequest {
  modelName?: string;
  modelType?: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
  isFavorite?: boolean;
}

export interface RemoteModel {
  modelName: string;
  modelType: string;
  config?: Record<string, unknown>;
}

export function fetchModels(request: RestRequestClient): Promise<PaginatedResponse<ModelProvider>> {
  return request.request<PaginatedResponse<ModelProvider>>("/models");
}

export function fetchAllModels(request: RestRequestClient): Promise<PaginatedResponse<ModelProvider>> {
  return request.request<PaginatedResponse<ModelProvider>>("/models/all");
}

export function createProvider(
  request: RestRequestClient,
  data: CreateProviderRequest,
): Promise<ModelProvider> {
  return request.request<ModelProvider>("/providers", {
    method: "POST",
    body: data,
  });
}

export function testProviderConnection(
  request: RestRequestClient,
  data: TestProviderConnectionRequest,
): Promise<ProviderConnectionTestResult> {
  return request.request<ProviderConnectionTestResult>("/providers/test-connection", {
    method: "POST",
    body: data,
  });
}

export function updateProvider(
  request: RestRequestClient,
  providerId: string,
  data: UpdateProviderRequest,
): Promise<ModelProvider> {
  return request.request<ModelProvider>(`/providers/${providerId}`, {
    method: "PUT",
    body: data,
  });
}

export function deleteProvider<T = { success: boolean }>(
  request: RestRequestClient,
  providerId: string,
): Promise<T> {
  return request.request<T>(`/providers/${providerId}`, {
    method: "DELETE",
  });
}

export function fetchRemoteModels(
  request: RestRequestClient,
  providerId: string,
): Promise<PaginatedResponse<RemoteModel>> {
  return request.request<PaginatedResponse<RemoteModel>>(`/providers/${providerId}/remote_models`);
}

export function createModel(request: RestRequestClient, data: ModelConfigRequest): Promise<Model> {
  return request.request<Model>("/models", {
    method: "POST",
    body: data,
  });
}

export function updateModel(
  request: RestRequestClient,
  modelId: string,
  data: UpdateModelRequest,
): Promise<Model> {
  return request.request<Model>(`/models/${modelId}`, {
    method: "PUT",
    body: data,
  });
}

export function deleteModel<T = { success: boolean }>(
  request: RestRequestClient,
  modelId: string,
): Promise<T> {
  return request.request<T>(`/models/${modelId}`, {
    method: "DELETE",
  });
}

export function toggleModelFavorite(request: RestRequestClient, modelId: string): Promise<Model> {
  return request.request<Model>(`/models/${modelId}/favorite`, {
    method: "PUT",
  });
}

export function toggleModelActive(request: RestRequestClient, modelId: string): Promise<Model> {
  return request.request<Model>(`/models/${modelId}/toggle-active`, {
    method: "PUT",
  });
}
