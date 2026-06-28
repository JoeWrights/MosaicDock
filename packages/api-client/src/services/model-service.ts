import type { ModelProvider, PaginatedResponse } from "@mosaic-dock/shared";
import type { RestRequestClient } from "../request";

export function fetchModels(request: RestRequestClient): Promise<PaginatedResponse<ModelProvider>> {
  return request.request<PaginatedResponse<ModelProvider>>("/models");
}

export function fetchAllModels(request: RestRequestClient): Promise<PaginatedResponse<ModelProvider>> {
  return request.request<PaginatedResponse<ModelProvider>>("/models/all");
}
