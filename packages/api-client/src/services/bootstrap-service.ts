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

export function reloadSkill<T = unknown>(
  request: RestRequestClient,
  skillId: string,
): Promise<T> {
  return request.request<T>(`/skills/${skillId}/reload`, {
    method: "POST",
  });
}

export function fetchSkillDocumentation<T = { content: string }>(
  request: RestRequestClient,
  skillId: string,
): Promise<T> {
  return request.request<T>(`/skills/${skillId}/documentation`);
}

export function installSkill<T = { success: boolean; message?: string; skillId?: string }>(
  request: RestRequestClient,
  file: File,
  force = false,
): Promise<T> {
  const body = new FormData();
  body.append("file", file);
  if (force) body.append("force", "true");

  return request.request<T>("/skills/install", {
    method: "POST",
    body,
  });
}

export function installSkillFromUrl<T = { success: boolean; message?: string; skillId?: string; skillIds?: string[] }>(
  request: RestRequestClient,
  url: string,
  force = false,
): Promise<T> {
  return request.request<T>("/skills/install-from-url", {
    method: "POST",
    body: { url, force },
  });
}

export function uninstallSkill<T = { success: boolean; message?: string }>(
  request: RestRequestClient,
  skillId: string,
): Promise<T> {
  return request.request<T>(`/skills/${skillId}/uninstall`, {
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
