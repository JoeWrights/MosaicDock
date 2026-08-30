import type { Message } from "@mosaic-dock/shared";
import type { MessageContentToolDetails } from "../http-client";
import type { RestRequestClient } from "../request";

export function createMessage(
  request: RestRequestClient,
  sessionId: string,
  content: string,
  files: unknown[] = [],
  replaceMessageId: string | null = null,
  knowledgeBaseIds?: string[],
): Promise<Message> {
  return request.request<Message>(`/sessions/${sessionId}/messages`, {
    method: "POST",
    body: {
      content,
      files,
      replaceMessageId,
      knowledgeBaseIds,
    },
  });
}

export function updateMessage<T = Message>(
  request: RestRequestClient,
  messageId: string,
  data: Record<string, unknown>,
): Promise<T> {
  return request.request<T>(`/messages/${messageId}`, {
    method: "PUT",
    body: data,
  });
}

export function deleteMessage<T = { success: boolean }>(
  request: RestRequestClient,
  messageId: string,
): Promise<T> {
  return request.request<T>(`/messages/${messageId}`, {
    method: "DELETE",
  });
}

export function updateMessageActiveContent<T = { success: boolean }>(
  request: RestRequestClient,
  contentId: string,
  messageId: string,
): Promise<T> {
  return request.request<T>(`/message-content/${contentId}/active`, {
    method: "PUT",
    body: { message_id: messageId },
  });
}

export function fetchMessageContentToolDetails(
  request: RestRequestClient,
  contentId: string,
): Promise<MessageContentToolDetails> {
  return request.request<MessageContentToolDetails>(
    `/message-content/${contentId}/tool-details`,
  );
}
