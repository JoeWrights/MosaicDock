declare module "event-source-polyfill" {
  export interface EventSourcePolyfillInit {
    headers?: Record<string, string>;
    heartbeatTimeout?: number;
  }

  export class EventSourcePolyfill {
    static readonly CONNECTING: number;
    static readonly OPEN: number;
    static readonly CLOSED: number;

    readonly readyState: number;
    onmessage: ((event: MessageEvent<string>) => void) | null;
    onopen: ((event: Event) => void) | null;
    onerror: ((event: Event) => void) | null;

    constructor(url: string, init?: EventSourcePolyfillInit);
    close(): void;
  }
}
