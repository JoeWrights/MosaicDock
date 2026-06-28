import type {
  BotInstance,
  CreateBotInstanceRequest,
  UpdateBotInstanceRequest,
} from "../http-client";
import type { RestRequestClient } from "../request";

export function fetchBotInstances(request: RestRequestClient): Promise<BotInstance[]> {
  return request.request<BotInstance[]>("/bot-admin/instances");
}

export function createBotInstance(
  request: RestRequestClient,
  data: CreateBotInstanceRequest,
): Promise<BotInstance> {
  return request.request<BotInstance>("/bot-admin/instances", {
    method: "POST",
    body: data,
  });
}

export function updateBotInstance(
  request: RestRequestClient,
  botId: string,
  data: UpdateBotInstanceRequest,
): Promise<BotInstance> {
  return request.request<BotInstance>(`/bot-admin/instances/${botId}`, {
    method: "PUT",
    body: data,
  });
}

export function startBotInstance(request: RestRequestClient, botId: string): Promise<BotInstance> {
  return request.request<BotInstance>(`/bot-admin/instances/${botId}/start`, {
    method: "POST",
  });
}

export function stopBotInstance(request: RestRequestClient, botId: string): Promise<BotInstance> {
  return request.request<BotInstance>(`/bot-admin/instances/${botId}/stop`, {
    method: "POST",
  });
}

export function deleteBotInstance<T = { success: boolean }>(
  request: RestRequestClient,
  botId: string,
): Promise<T> {
  return request.request<T>(`/bot-admin/instances/${botId}`, {
    method: "DELETE",
  });
}
