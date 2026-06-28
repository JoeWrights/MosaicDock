import type {
  Character,
  CharacterGroup,
  CharacterMemorySettings,
  CharacterPluginDefinition,
  CharacterSettings,
  CreateCharacterRequest,
  McpServer,
  ModelProvider,
  UpdateCharacterRequest,
} from "@mosaic-dock/shared";

export type CharacterTabKey =
  | "basic"
  | "prompt"
  | "model"
  | "memory"
  | "local_tools"
  | "mcp_tools"
  | "skills";

export interface SkillOption {
  id: string;
  name?: string;
  displayName?: string;
  description?: string;
  enabled?: boolean;
  builtIn?: boolean;
  version?: string;
}

export interface CharacterFormState {
  title: string;
  description: string;
  groupId: string;
  modelId: string;
  avatarUrl: string;
  avatarFile: File | null;
  systemPrompt: string;
  useUserPrompt: boolean;
  overrideModelParams: boolean;
  modelTemperature: number | null;
  modelTopP: number | null;
  modelFrequencyPenalty: number | null;
  memory: Required<CharacterMemorySettings>;
  toolsAuto: boolean;
  toolSettings: Record<string, boolean | string[]>;
  mcpAuto: boolean;
  selectedMcpServerIds: string[];
  skillsAuto: boolean;
  skillSettings: Record<string, boolean>;
}

export const defaultCharacterForm: CharacterFormState = {
  title: "",
  description: "",
  groupId: "",
  modelId: "",
  avatarUrl: "",
  avatarFile: null,
  systemPrompt: "",
  useUserPrompt: false,
  overrideModelParams: false,
  modelTemperature: null,
  modelTopP: null,
  modelFrequencyPenalty: null,
  memory: {
    maxMemoryLength: 20,
    compressionTriggerRatio: 0.8,
    compressionTargetRatio: 0.5,
    summaryMode: "memory_sync",
    maxTokensLimit: null,
  },
  toolsAuto: false,
  toolSettings: {},
  mcpAuto: false,
  selectedMcpServerIds: [],
  skillsAuto: false,
  skillSettings: {},
};

export function createCharacterForm(character?: Character | null): CharacterFormState {
  if (!character) return { ...defaultCharacterForm, memory: { ...defaultCharacterForm.memory } };

  const settings = character.settings ?? {};
  const memory = settings.memory ?? {};

  return {
    ...defaultCharacterForm,
    title: character.title ?? "",
    description: character.description ?? "",
    groupId: character.groupId ?? "",
    modelId: character.modelId ?? "",
    avatarUrl: character.avatarUrl ?? "",
    systemPrompt: typeof settings.systemPrompt === "string" ? settings.systemPrompt : "",
    useUserPrompt: Boolean(settings.useUserPrompt),
    overrideModelParams: Boolean(settings.overrideModelParams),
    modelTemperature: toNullableNumber(settings.modelTemperature),
    modelTopP: toNullableNumber(settings.modelTopP),
    modelFrequencyPenalty: toNullableNumber(settings.modelFrequencyPenalty),
    memory: {
      maxMemoryLength:
        typeof memory.maxMemoryLength === "number" ? memory.maxMemoryLength : null,
      compressionTriggerRatio:
        typeof memory.compressionTriggerRatio === "number" ? memory.compressionTriggerRatio : 0.8,
      compressionTargetRatio:
        typeof memory.compressionTargetRatio === "number" ? memory.compressionTargetRatio : 0.5,
      summaryMode: memory.summaryMode ?? "memory_sync",
      maxTokensLimit: typeof memory.maxTokensLimit === "number" ? memory.maxTokensLimit : null,
    },
    toolsAuto: settings.tools === true,
    toolSettings:
      settings.tools && typeof settings.tools === "object" && !Array.isArray(settings.tools)
        ? settings.tools
        : {},
    mcpAuto: settings.mcpServers === true,
    selectedMcpServerIds: Array.isArray(settings.mcpServers) ? settings.mcpServers : [],
    skillsAuto: settings.skills === true,
    skillSettings:
      settings.skills && typeof settings.skills === "object" && !Array.isArray(settings.skills)
        ? settings.skills
        : {},
  };
}

export function buildCharacterPayload(
  form: CharacterFormState,
): CreateCharacterRequest | UpdateCharacterRequest {
  const settings: CharacterSettings = {
    assistantName: "",
    assistantIdentity: "",
    systemPrompt: form.systemPrompt,
    memoryType: "sliding_window",
    modelTemperature: form.modelTemperature,
    modelTopP: form.modelTopP,
    modelFrequencyPenalty: form.modelFrequencyPenalty,
    overrideModelParams: form.overrideModelParams,
    useUserPrompt: form.useUserPrompt,
    memory: {
      maxMemoryLength: form.memory.maxMemoryLength,
      compressionTriggerRatio: form.memory.compressionTriggerRatio,
      compressionTargetRatio: form.memory.compressionTargetRatio,
      summaryMode: form.memory.summaryMode,
      maxTokensLimit: form.memory.maxTokensLimit,
    },
    tools: form.toolsAuto ? true : form.toolSettings,
    mcpServers: form.mcpAuto ? true : form.selectedMcpServerIds,
    skills: form.skillsAuto ? true : form.skillSettings,
  };

  return {
    title: form.title.trim(),
    description: form.description.trim(),
    groupId: form.groupId || null,
    modelId: form.modelId || null,
    settings,
  };
}

export function validateCharacterForm(form: CharacterFormState): { ok: boolean; tab: CharacterTabKey; message?: string } {
  const title = form.title.trim();
  if (title.length < 2 || title.length > 20) {
    return { ok: false, tab: "basic", message: "助手名称需要 2-20 个字符" };
  }
  return { ok: true, tab: "basic" };
}

export function flattenTextModels(providers: ModelProvider[]) {
  return providers.flatMap((provider) =>
    (provider.models ?? [])
      .filter((model) => model.modelType === "text" && model.isActive !== false)
      .map((model) => ({ provider, model })),
  );
}

export function normalizeSkills(response: unknown): SkillOption[] {
  const items =
    response && typeof response === "object" && "items" in response
      ? (response as { items?: unknown }).items
      : response;
  if (!Array.isArray(items)) return [];

  return items
    .filter((item): item is SkillOption => {
      return typeof item === "object" && item !== null && "id" in item;
    })
    .filter((skill) => skill.enabled !== false);
}

export function normalizeMcpServers(response: unknown): McpServer[] {
  const items =
    response && typeof response === "object" && "items" in response
      ? (response as { items?: unknown }).items
      : response;
  if (!Array.isArray(items)) return [];

  return items.filter((item): item is McpServer => {
    return (
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      "name" in item &&
      typeof (item as { id: unknown }).id === "string" &&
      typeof (item as { name: unknown }).name === "string"
    );
  });
}

export function visibleMcpServers(servers: unknown): McpServer[] {
  return normalizeMcpServers(servers).filter((server) => server.enabled !== false);
}

export function localToolPlugins(response: { plugins?: CharacterPluginDefinition[] } | null): CharacterPluginDefinition[] {
  return (response?.plugins ?? []).filter((plugin) => !plugin.isMcp && !plugin.isSkill);
}

export function toggleRecordValue<T extends string>(
  current: Record<T, boolean>,
  key: T,
  enabled: boolean,
): Record<T, boolean> {
  return { ...current, [key]: enabled };
}

export function updateToolConfig(
  current: Record<string, boolean | string[]>,
  plugin: CharacterPluginDefinition,
  enabledToolNames: string[],
  autoEnableAll: boolean,
): Record<string, boolean | string[]> {
  const allToolNames = (plugin.tools ?? []).map((tool) => tool.name);
  const next = { ...current };

  if (enabledToolNames.length === 0) {
    next[plugin.pluginId] = false;
  } else if (enabledToolNames.length === allToolNames.length && autoEnableAll) {
    next[plugin.pluginId] = true;
  } else {
    next[plugin.pluginId] = enabledToolNames;
  }

  return next;
}

export function parseTokenLimit(value: string): number | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d+(?:\.\d+)?)(k|m)?$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === "m") return Math.round(amount * 1_000_000);
  if (unit === "k") return Math.round(amount * 1_000);
  return Math.round(amount);
}

export function formatTokenLimit(value: number | null): string {
  if (value === null) return "";
  if (value >= 1_000_000 && value % 1_000_000 === 0) return `${value / 1_000_000}M`;
  if (value >= 1_000 && value % 1_000 === 0) return `${value / 1_000}K`;
  return String(value);
}

export function groupName(groups: CharacterGroup[], groupId?: string | null) {
  return groups.find((group) => group.id === groupId)?.name ?? "未分组";
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}
