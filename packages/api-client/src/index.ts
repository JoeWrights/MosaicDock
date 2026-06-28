import { ApiClient, type ApiClientOptions } from "./http-client";
import { ChatStreamService } from "./stream";
import { SessionEventsService } from "./session-events";

export * from "./http-client";
export * from "./session-events";
export * from "./stream";

export interface MosaicApi {
  client: ApiClient;
  chatStream: ChatStreamService;
  sessionEvents: SessionEventsService;
}

export function createMosaicApi(options: ApiClientOptions = {}): MosaicApi {
  const client = new ApiClient(options);
  const tokenProvider = options.tokenProvider;
  const clientIdProvider = options.clientIdProvider;

  return {
    client,
    chatStream: new ChatStreamService(
      () => client.getBaseURL(),
      tokenProvider,
      clientIdProvider,
      options.fetcher,
    ),
    sessionEvents: new SessionEventsService(
      () => client.getBaseURL(),
      tokenProvider,
      clientIdProvider,
    ),
  };
}

export const mosaicApi = createMosaicApi();
