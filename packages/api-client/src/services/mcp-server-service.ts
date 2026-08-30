import type { McpServer } from "@mosaic-dock/shared";
import type { RestRequestClient } from "../request";

export function fetchMcpServers(request: RestRequestClient): Promise<McpServer[]> {
  return request.request<McpServer[] | { items?: unknown }>("/mcp-servers").then(normalizeMcpServers);
}

export function createMcpServer<T = McpServer>(
  request: RestRequestClient,
  data: Record<string, unknown>,
): Promise<T> {
  return request.request<T>("/mcp-servers", {
    method: "POST",
    body: data,
  });
}

export function toggleMcpServer<T = unknown>(
  request: RestRequestClient,
  serverId: string,
  enabled: boolean,
): Promise<T> {
  return request.request<T>(`/mcp-servers/${serverId}/toggle`, {
    method: "PATCH",
    body: { enabled },
  });
}

export function refreshMcpServerTools<T = unknown>(
  request: RestRequestClient,
  serverId: string,
): Promise<T> {
  return request.request<T>(`/mcp-servers/${serverId}/refresh-tools`, {
    method: "POST",
  });
}

function normalizeMcpServers(response: McpServer[] | { items?: unknown }): McpServer[] {
  const items =
    response && typeof response === "object" && "items" in response ? response.items : response;

  if (!Array.isArray(items)) return [];

  return items.filter((item): item is McpServer => {
    return (
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      "name" in item &&
      typeof (item as { id: unknown }).id === "string" &&
      typeof (item as { name: unknown }).name === "string"
    );
  });
}
