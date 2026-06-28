import type { RestRequestClient } from "../request";
import type { WorkspaceChildrenResponse, WorkspaceTreeResponse } from "../http-client";

export function fetchWorkspaceTree(
  request: RestRequestClient,
  sessionId: string,
): Promise<WorkspaceTreeResponse> {
  return request.request<WorkspaceTreeResponse>(`/sessions/${sessionId}/workspace/tree`);
}

export function fetchWorkspaceChildren(
  request: RestRequestClient,
  sessionId: string,
  path: string,
): Promise<WorkspaceChildrenResponse> {
  return request.request<WorkspaceChildrenResponse>(`/sessions/${sessionId}/workspace/children`, {
    params: { path },
  });
}
