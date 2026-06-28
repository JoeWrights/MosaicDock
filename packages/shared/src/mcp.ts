import type { ISODateString } from "./common";

export interface McpServer {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
  isActive?: boolean;
  status?: string;
  userId?: string;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
  [key: string]: unknown;
}
