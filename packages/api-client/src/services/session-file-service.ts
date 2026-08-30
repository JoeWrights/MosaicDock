import type { FileAttachment } from "@mosaic-dock/shared";
import type { RestRequestClient } from "../request";

export function uploadSessionFile(
  request: RestRequestClient,
  sessionId: string,
  file: File,
): Promise<FileAttachment> {
  const body = new FormData();
  body.append("file", file);

  return request.request<FileAttachment>(`/sessions/${sessionId}/files`, {
    method: "POST",
    body,
  });
}
