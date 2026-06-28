import axios, {
  AxiosError,
  type AxiosAdapter,
  type AxiosInstance,
  type AxiosRequestConfig,
} from "axios";
import { getClientId } from "@mosaic-dock/shared";

export interface RestRequestClientOptions {
  baseURL?: string;
  adapter?: AxiosAdapter;
  tokenProvider?: () => string | null;
  clientIdProvider?: () => string;
}

export interface RestRequestOptions extends Omit<AxiosRequestConfig, "url" | "data"> {
  body?: unknown;
}

export interface RestRequestClient {
  request<T>(endpoint: string, options?: RestRequestOptions): Promise<T>;
}

export function createRestRequestClient(options: RestRequestClientOptions = {}): RestRequestClient {
  return new AxiosRestRequestClient(options);
}

class AxiosRestRequestClient implements RestRequestClient {
  private readonly instance: AxiosInstance;
  private readonly tokenProvider: () => string | null;
  private readonly clientIdProvider: () => string;

  constructor(options: RestRequestClientOptions = {}) {
    this.tokenProvider = options.tokenProvider ?? defaultTokenProvider;
    this.clientIdProvider = options.clientIdProvider ?? getClientId;
    this.instance = axios.create({
      baseURL: options.baseURL ?? "/api/v1",
      adapter: options.adapter,
      validateStatus: () => true,
    });

    this.instance.interceptors.request.use((config) => {
      if (!(typeof FormData !== "undefined" && config.data instanceof FormData)) {
        config.headers.set("Content-Type", "application/json");
      }
      config.headers.set("X-Client-Id", this.clientIdProvider());

      const token = this.tokenProvider();
      if (token) {
        config.headers.set("Authorization", `Bearer ${token}`);
      }

      return config;
    });

    this.instance.interceptors.response.use(
      (response) => {
        if (response.status < 200 || response.status >= 300) {
          throw new Error(extractErrorMessage(response.data, response.status));
        }

        return response.data;
      },
      (error: AxiosError) => {
        if (error.response) {
          throw new Error(extractErrorMessage(error.response.data, error.response.status));
        }
        throw error;
      },
    );
  }

  async request<T>(endpoint: string, options: RestRequestOptions = {}): Promise<T> {
    const { body, ...axiosOptions } = options;
    return this.instance.request<T, T>({
      url: endpoint,
      data: body,
      ...axiosOptions,
    });
  }
}

function defaultTokenProvider(): string | null {
  if (typeof sessionStorage !== "undefined") {
    const sessionToken = sessionStorage.getItem("token");
    if (sessionToken) return sessionToken;
  }

  if (typeof localStorage !== "undefined") {
    return localStorage.getItem("token");
  }

  return null;
}

export function extractErrorMessage(payload: unknown, status?: number): string {
  if (typeof payload === "object" && payload !== null) {
    const record = payload as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (typeof record.error === "string") return record.error;
    if (
      typeof record.message === "object" &&
      record.message !== null &&
      "error" in record.message
    ) {
      return String((record.message as { error: unknown }).error);
    }
  }

  if (typeof payload === "string" && payload) return payload;
  return status ? `请求失败：${status}` : "请求失败";
}
