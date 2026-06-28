import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionEventsService } from "./session-events";

const eventSources: MockEventSource[] = [];

vi.mock("event-source-polyfill", () => {
  class EventSourcePolyfill {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 2;

    readonly readyState = EventSourcePolyfill.OPEN;
    readonly close = vi.fn();
    onmessage: ((event: MessageEvent<string>) => void) | null = null;
    onopen: ((event: Event) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    constructor(
      readonly url: string,
      readonly init?: unknown,
    ) {
      eventSources.push(this);
    }
  }

  return { EventSourcePolyfill };
});

type MockEventSource = {
  url: string;
  close: ReturnType<typeof vi.fn>;
};

describe("SessionEventsService", () => {
  afterEach(() => {
    eventSources.length = 0;
    vi.useRealTimers();
  });

  it("keeps the session event stream open across an immediate reconnect", () => {
    vi.useFakeTimers();
    const service = new SessionEventsService(
      () => "/api/v1",
      () => "token-123",
      () => "client-123",
    );

    service.connect();
    service.disconnect();
    service.connect();
    vi.runAllTimers();

    expect(eventSources).toHaveLength(1);
    expect(eventSources[0]?.url).toBe("/api/v1/events/sessions");
    expect(eventSources[0]?.close).not.toHaveBeenCalled();
  });

  it("closes the session event stream when no reconnect happens", () => {
    vi.useFakeTimers();
    const service = new SessionEventsService(
      () => "/api/v1",
      () => "token-123",
      () => "client-123",
    );

    service.connect();
    service.disconnect();
    vi.runAllTimers();

    expect(eventSources).toHaveLength(1);
    expect(eventSources[0]?.close).toHaveBeenCalledTimes(1);
  });
});
