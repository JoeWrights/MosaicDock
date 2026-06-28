import type { RestRequestClient } from "../request";

export function fetchSessionGroups<T = unknown>(request: RestRequestClient): Promise<T> {
  return request.request<T>("/session-groups");
}

export function createSessionGroup<T = unknown>(
  request: RestRequestClient,
  data: { name: string },
): Promise<T> {
  return request.request<T>("/session-groups", {
    method: "POST",
    body: data,
  });
}

export function updateSessionGroup<T = unknown>(
  request: RestRequestClient,
  groupId: string,
  data: { name: string },
): Promise<T> {
  return request.request<T>(`/session-groups/${groupId}`, {
    method: "PUT",
    body: data,
  });
}

export function deleteSessionGroup<T = unknown>(
  request: RestRequestClient,
  groupId: string,
): Promise<T> {
  return request.request<T>(`/session-groups/${groupId}`, {
    method: "DELETE",
  });
}

export function reorderSessionGroups<T = unknown>(
  request: RestRequestClient,
  groupIds: string[],
): Promise<T> {
  return request.request<T>("/session-groups/reorder", {
    method: "POST",
    body: { groupIds },
  });
}

export function fetchKnowledgeBases<T = unknown>(request: RestRequestClient): Promise<T> {
  return request.request<T>("/knowledge-bases");
}

export function fetchSkills<T = unknown>(request: RestRequestClient): Promise<T> {
  return request.request<T>("/skills");
}

export function triggerSkillScan<T = unknown>(request: RestRequestClient): Promise<T> {
  return request.request<T>("/skills/scan", {
    method: "POST",
  });
}

export function toggleSkill<T = unknown>(
  request: RestRequestClient,
  skillId: string,
  enabled: boolean,
): Promise<T> {
  return request.request<T>(`/skills/${skillId}/${enabled ? "enable" : "disable"}`, {
    method: "POST",
  });
}

export function fetchAppearanceSettings<T = unknown>(request: RestRequestClient): Promise<T> {
  return request.request<T>("/settings/appearance");
}

export function fetchGlobalPlugins<T = unknown>(request: RestRequestClient): Promise<T> {
  return request.request<T>("/settings/plugins/global");
}

export function updateGlobalPluginStatus<T = unknown>(
  request: RestRequestClient,
  pluginId: string,
  enabled: boolean,
): Promise<T> {
  return request.request<T>("/settings/plugins/global", {
    method: "PUT",
    body: { pluginId, enabled },
  });
}

export function fetchCharacters<T = unknown>(request: RestRequestClient): Promise<T> {
  return request.request<T>("/characters");
}

export function fetchTeams<T = unknown>(request: RestRequestClient): Promise<T> {
  return request.request<T>("/teams");
}
