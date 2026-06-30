import type {
  Character,
  CharacterGroup,
  CharacterListParams,
  CharacterListResponse,
  CharacterToolsResponse,
  CreateCharacterGroupRequest,
  CreateCharacterRequest,
  CreateTeamRequest,
  Team,
  TeamListResponse,
  UpdateCharacterGroupRequest,
  UpdateCharacterRequest,
  UpdateTeamRequest,
} from "@mosaic-dock/shared";
import type { RestRequestClient } from "../request";

export function fetchCharacters(
  request: RestRequestClient,
  params: CharacterListParams = {},
): Promise<CharacterListResponse> {
  return request.request<CharacterListResponse>("/characters", {
    params: normalizeCharacterListParams(params),
  });
}

export function fetchCharacter(
  request: RestRequestClient,
  characterId: string,
): Promise<Character> {
  return request.request<Character>(`/characters/${characterId}`);
}

export function createCharacter(
  request: RestRequestClient,
  data: CreateCharacterRequest,
): Promise<Character> {
  return request.request<Character>("/characters", {
    method: "POST",
    body: data,
  });
}

export function updateCharacter(
  request: RestRequestClient,
  characterId: string,
  data: UpdateCharacterRequest,
): Promise<Character> {
  return request.request<Character>(`/characters/${characterId}`, {
    method: "PUT",
    body: data,
  });
}

export function deleteCharacter<T = { success: boolean }>(
  request: RestRequestClient,
  characterId: string,
): Promise<T> {
  return request.request<T>(`/characters/${characterId}`, {
    method: "DELETE",
  });
}

export function fetchCharacterGroups(request: RestRequestClient): Promise<CharacterGroup[]> {
  return request.request<CharacterGroup[]>("/character-groups");
}

export function createCharacterGroup(
  request: RestRequestClient,
  data: CreateCharacterGroupRequest,
): Promise<CharacterGroup> {
  return request.request<CharacterGroup>("/character-groups", {
    method: "POST",
    body: data,
  });
}

export function updateCharacterGroup(
  request: RestRequestClient,
  groupId: string,
  data: UpdateCharacterGroupRequest,
): Promise<CharacterGroup> {
  return request.request<CharacterGroup>(`/character-groups/${groupId}`, {
    method: "PUT",
    body: data,
  });
}

export function deleteCharacterGroup<T = { success: boolean }>(
  request: RestRequestClient,
  groupId: string,
): Promise<T> {
  return request.request<T>(`/character-groups/${groupId}`, {
    method: "DELETE",
  });
}

export function fetchTeams(request: RestRequestClient): Promise<TeamListResponse> {
  return request.request<TeamListResponse>("/teams");
}

export function createTeam(request: RestRequestClient, data: CreateTeamRequest): Promise<Team> {
  return request.request<Team>("/teams", {
    method: "POST",
    body: data,
  });
}

export function updateTeam(
  request: RestRequestClient,
  teamId: string,
  data: UpdateTeamRequest,
): Promise<Team> {
  return request.request<Team>(`/teams/${teamId}`, {
    method: "PUT",
    body: data,
  });
}

export function deleteTeam<T = { success: boolean }>(
  request: RestRequestClient,
  teamId: string,
): Promise<T> {
  return request.request<T>(`/teams/${teamId}`, {
    method: "DELETE",
  });
}

export function uploadCharacterAvatar(
  request: RestRequestClient,
  characterId: string,
  file: File,
): Promise<{ url: string }> {
  const body = new FormData();
  body.append("avatar", file);

  return request.request<{ url: string }>(`/characters/${characterId}/avatars`, {
    method: "POST",
    body,
  });
}

export function fetchCharacterTools(
  request: RestRequestClient,
  characterId: string,
): Promise<CharacterToolsResponse> {
  return request.request<CharacterToolsResponse>(`/characters/${characterId}/tools`);
}

function normalizeCharacterListParams(params: CharacterListParams) {
  return {
    ...(typeof params.skip === "number" ? { skip: params.skip } : {}),
    ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
    ...(params.groupId !== undefined ? { groupId: params.groupId } : {}),
  };
}
