/// <reference path="./event-source-polyfill.d.ts" />

import { EventSourcePolyfill } from "event-source-polyfill";
import { getClientId } from "@mosaic-dock/shared";

export type SessionEventType =
  | "connected"
  | "session_created"
  | "session_deleted"
  | "session_renamed"
  | "session_updated"
  | "stream_started"
  | "stream_finished"
  | "user_message_created"
  | "sub_agent_create"
  | "sub_agent_closed";

export interface SessionEvent {
  type: SessionEventType;
  userId: string;
  sessionId: string;
  timestamp: string;
  payload?: Record<string, unknown>;
  source?: string;
}

type EventListener = (event: SessionEvent) => void;

export class SessionEventsService {
  private eventSource: EventSourcePolyfill | null = null;
  private readonly listeners = new Map<SessionEventType | "*", Set<EventListener>>();
  private readonly clientId: string;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly getBaseURL: () => string,
    private readonly tokenProvider: () => string | null = defaultTokenProvider,
    clientIdProvider: () => string = getClientId,
  ) {
    this.clientId = clientIdProvider();
  }

  getClientId(): string {
    return this.clientId;
  }

  connect(): void {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }

    if (
      this.eventSource &&
      this.eventSource.readyState !== EventSourcePolyfill.CLOSED
    ) {
      return;
    }

    this.eventSource = new EventSourcePolyfill(`${this.getBaseURL()}/events/sessions`, {
      headers: {
        Authorization: `Bearer ${this.tokenProvider() ?? ""}`,
        "X-Client-Id": this.clientId,
      },
      heartbeatTimeout: 180000,
    });

    this.eventSource.onmessage = (message) => {
      const event = JSON.parse(message.data) as SessionEvent;
      this.handleEvent(event);
    };
  }

  on(eventType: SessionEventType | "*", listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    return () => {
      const set = this.listeners.get(eventType);
      set?.delete(listener);
      if (set?.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }

  disconnect(): void {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
    }

    this.disconnectTimer = setTimeout(() => {
      this.eventSource?.close();
      this.eventSource = null;
      this.listeners.clear();
      this.disconnectTimer = null;
    }, 0);
  }

  private handleEvent(event: SessionEvent): void {
    for (const listener of this.listeners.get(event.type) ?? []) {
      listener(event);
    }
    for (const listener of this.listeners.get("*") ?? []) {
      listener(event);
    }
  }
}

function defaultTokenProvider(): string | null {
  return (
    (typeof sessionStorage !== "undefined" && sessionStorage.getItem("token")) ||
    (typeof localStorage !== "undefined" && localStorage.getItem("token")) ||
    null
  );
}
