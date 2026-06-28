export const RoutePath = {
  ROOT: "/",
  LOGIN: "/login",
  NEW_SESSION: "/new-session",
  CHAT: "/chat",
  BOTS_MANAGEMENT: "/bots/management",
  MODELS: "/models",
  CHARACTERS: "/characters",
  CHARACTERS_ASSISTANTS: "/characters/assistants",
  CHARACTERS_TEAMS: "/characters/teams",
  KNOWLEDGE_BASE: "/knowledge-base",
  PLUGINS: "/plugins",
  PLUGINS_LOCAL_TOOLS: "/plugins/local-tools",
  PLUGINS_SKILLS: "/plugins/skills",
  PLUGINS_MCP: "/plugins/mcp",
  SCHEDULER: "/scheduler",
} as const;

export const MenuLabel = {
  CHAT: "聊天工作台",
  MODELS: "模型配置",
  SETTINGS: "系统设置",
} as const;
