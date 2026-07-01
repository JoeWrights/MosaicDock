export interface Model {
  id: string;
  modelName: string;
  modelType: string;
  providerId: string;
  providerName?: string;
  config?: ModelConfig;
  isActive: boolean;
  contextWindow?: number;
  maxOutputTokens?: number;
  description?: string;
  isFavorite?: boolean;
  thinkingEfforts?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ModelConfig {
  inputCapabilities?: string[];
  outputCapabilities?: string[];
  features?: string[];
  contextWindow?: number;
  maxOutputTokens?: number;
  vectorDimensions?: number;
}

export interface ModelProvider {
  id: string;
  name: string;
  provider?: string;
  protocol?: string;
  apiBase?: string;
  apiUrl?: string;
  apiKey?: string;
  apiKeySet: boolean;
  isActive: boolean;
  avatarUrl?: string;
  attributes?: unknown;
  createdAt?: string;
  updatedAt?: string;
  models?: Model[];
}

export interface User {
  id: string;
  username: string;
  nickname?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  role?: "primary" | "subaccount";
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
  type?: "phone" | "email";
}

export interface LoginResponse {
  accessToken: string;
  tokenType?: string;
  user: User;
}
