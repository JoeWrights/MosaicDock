import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Bot, Brain, Code2, Database, ImagePlus, List, Settings2, UserRound, Wrench, X } from "lucide-react";
import type {
  Character,
  CharacterGroup,
  CharacterPluginDefinition,
  CharacterToolsResponse,
  McpServer,
  ModelProvider,
} from "@mosaic-dock/shared";
import type { ApiClient } from "@mosaic-dock/api-client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Spinner } from "../../components/ui/spinner";
import { Switch } from "../../components/ui/switch";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../lib/utils";
import {
  buildCharacterPayload,
  createCharacterForm,
  defaultCharacterForm,
  flattenTextModels,
  formatTokenLimit,
  localToolPlugins,
  normalizeSkills,
  normalizeMcpServers,
  parseTokenLimit,
  updateToolConfig,
  validateCharacterForm,
  visibleMcpServers,
  type CharacterFormState,
  type CharacterTabKey,
  type SkillOption,
} from "./character-settings";

export interface CharacterModalApi {
  client: Pick<
    ApiClient,
    | "fetchCharacter"
    | "fetchModels"
    | "fetchSkills"
    | "fetchMcpServers"
    | "fetchCharacterTools"
    | "createCharacter"
    | "updateCharacter"
    | "uploadCharacterAvatar"
  >;
}

interface CharacterModalProps {
  open: boolean;
  characterId: string | null;
  groups: CharacterGroup[];
  api: CharacterModalApi;
  onClose: () => void;
  onSaved: (character: Character) => void;
}

const tabs: Array<{ key: CharacterTabKey; label: string; icon: typeof UserRound }> = [
  { key: "basic", label: "基础", icon: UserRound },
  { key: "prompt", label: "提示词", icon: Brain },
  { key: "model", label: "模型", icon: Bot },
  { key: "memory", label: "记忆", icon: List },
  { key: "local_tools", label: "本地工具", icon: Wrench },
  { key: "mcp_tools", label: "MCP 工具", icon: Settings2 },
  { key: "skills", label: "Skills", icon: Code2 },
];

export function CharacterModal({
  open,
  characterId,
  groups,
  api,
  onClose,
  onSaved,
}: CharacterModalProps) {
  const [shouldRender, setShouldRender] = useState(open);
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<CharacterTabKey>("basic");
  const [form, setForm] = useState<CharacterFormState>(defaultCharacterForm);
  const [models, setModels] = useState<ModelProvider[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [plugins, setPlugins] = useState<CharacterPluginDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<{ url: string; file: File } | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [toolConfigPlugin, setToolConfigPlugin] = useState<CharacterPluginDefinition | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textModels = useMemo(() => flattenTextModels(models), [models]);
  const enabledMcpServers = useMemo(() => visibleMcpServers(mcpServers), [mcpServers]);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timer = window.setTimeout(() => setShouldRender(false), 200);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setActiveTab("basic");

      try {
        const [character, modelResponse, skillsResponse, servers, toolsResponse] = await Promise.all([
          characterId ? api.client.fetchCharacter(characterId) : Promise.resolve(null),
          api.client.fetchModels(),
          api.client.fetchSkills(),
          api.client.fetchMcpServers(),
          api.client.fetchCharacterTools(characterId ?? "__new_character__"),
        ]);

        if (cancelled) return;
        setForm(createCharacterForm(character));
        setModels(modelResponse.items ?? []);
        setSkills(normalizeSkills(skillsResponse));
        setMcpServers(normalizeMcpServers(servers));
        setPlugins(localToolPlugins(toolsResponse as CharacterToolsResponse));
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "角色配置加载失败");
          setForm(createCharacterForm(null));
          setModels([]);
          setSkills([]);
          setMcpServers([]);
          setPlugins([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [api, characterId, open]);

  if (!shouldRender) return null;

  function patchForm(patch: Partial<CharacterFormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function saveCharacter() {
    const validation = validateCharacterForm(form);
    if (!validation.ok) {
      setActiveTab(validation.tab);
      setError(validation.message ?? "请检查表单");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = buildCharacterPayload(form);
      const saved = characterId
        ? await api.client.updateCharacter(characterId, payload)
        : await api.client.createCharacter(payload as ReturnType<typeof buildCharacterPayload> & { title: string });

      let nextCharacter = saved;
      if (form.avatarFile) {
        const avatar = await api.client.uploadCharacterAvatar(saved.id, form.avatarFile);
        nextCharacter = { ...saved, avatarUrl: avatar.url };
      }
      onSaved(nextCharacter);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "角色保存失败");
    } finally {
      setSaving(false);
    }
  }

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("头像图片不能超过 5MB");
      return;
    }
    const url = createObjectUrl(file);
    setCropSource({ url, file });
    event.target.value = "";
  }

  async function confirmCrop() {
    if (!cropSource) return;
    const cropped = await cropSquareImage(cropSource.file, cropZoom);
    patchForm({
      avatarFile: cropped,
      avatarUrl: createObjectUrl(cropped),
    });
    setCropSource(null);
    setCropZoom(1);
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-70 grid place-items-center bg-black/35 px-4 transition-opacity duration-200 ease-out",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        role="dialog"
        aria-labelledby="character-modal-title"
        className={cn(
          "flex h-[80vh] w-full max-w-[900px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_18px_52px_rgba(0,0,0,0.22)] ring-1 ring-slate-200 transition-all duration-200 ease-out dark:bg-[#232428] dark:ring-[#2f3136]",
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-[0.98] opacity-0",
        )}
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-[#2f3136]">
          <h2 id="character-modal-title" className="text-base font-bold">
            {characterId ? "编辑角色" : "新建助手"}
          </h2>
          <button
            type="button"
            aria-label="关闭"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <nav aria-label="角色配置" className="flex shrink-0 items-center gap-1 border-b border-slate-100 px-5 dark:border-[#2f3136]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm transition-colors",
                  activeTab === tab.key
                    ? "border-pink-500 text-pink-500"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setActiveTab(tab.key)}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="grid h-full min-h-64 place-items-center">
              <Spinner label="正在加载角色配置" />
            </div>
          ) : (
            <>
              {error ? (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              ) : null}
              {activeTab === "basic" ? (
                <BasicTab
                  form={form}
                  groups={groups}
                  fileInputRef={fileInputRef}
                  onAvatarClick={() => fileInputRef.current?.click()}
                  onAvatarChange={chooseAvatar}
                  onChange={patchForm}
                />
              ) : null}
              {activeTab === "prompt" ? <PromptTab form={form} onChange={patchForm} /> : null}
              {activeTab === "model" ? (
                <ModelTab form={form} models={textModels} onChange={patchForm} />
              ) : null}
              {activeTab === "memory" ? <MemoryTab form={form} onChange={patchForm} /> : null}
              {activeTab === "local_tools" ? (
                <LocalToolsTab
                  form={form}
                  plugins={plugins}
                  onChange={patchForm}
                  onOpenConfig={setToolConfigPlugin}
                />
              ) : null}
              {activeTab === "mcp_tools" ? (
                <McpToolsTab form={form} servers={enabledMcpServers} onChange={patchForm} />
              ) : null}
              {activeTab === "skills" ? (
                <SkillsTab form={form} skills={skills} onChange={patchForm} />
              ) : null}
            </>
          )}
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-[#2f3136]">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            className="bg-pink-500 text-white shadow-none hover:bg-pink-500/90"
            disabled={loading || saving}
            onClick={() => void saveCharacter()}
          >
            {saving ? "应用中..." : "应用全部设置"}
          </Button>
        </footer>
      </div>

      {cropSource ? (
        <AvatarCropDialog
          sourceUrl={cropSource.url}
          zoom={cropZoom}
          onZoomChange={setCropZoom}
          onCancel={() => setCropSource(null)}
          onConfirm={() => void confirmCrop()}
        />
      ) : null}

      {toolConfigPlugin ? (
        <ToolConfigDialog
          plugin={toolConfigPlugin}
          current={form.toolSettings[toolConfigPlugin.pluginId]}
          onClose={() => setToolConfigPlugin(null)}
          onSave={(enabledToolNames, autoEnableAll) => {
            patchForm({
              toolSettings: updateToolConfig(
                form.toolSettings,
                toolConfigPlugin,
                enabledToolNames,
                autoEnableAll,
              ),
            });
            setToolConfigPlugin(null);
          }}
        />
      ) : null}
    </div>
  );
}

function BasicTab({
  form,
  groups,
  fileInputRef,
  onAvatarClick,
  onAvatarChange,
  onChange,
}: {
  form: CharacterFormState;
  groups: CharacterGroup[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onAvatarClick: () => void;
  onAvatarChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onChange: (patch: Partial<CharacterFormState>) => void;
}) {
  return (
    <div className="space-y-7">
      <SettingRow title="角色头像" description="点击头像可以更新新的头像，支持上传图片文件">
        <button
          type="button"
          aria-label="选择头像"
          className="grid h-20 w-20 place-items-center overflow-hidden rounded-xl bg-slate-100 text-slate-400 hover:ring-2 hover:ring-pink-300"
          onClick={onAvatarClick}
        >
          {form.avatarUrl ? (
            <img src={form.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-7 w-7" aria-hidden="true" />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="上传头像文件"
          onChange={onAvatarChange}
        />
      </SettingRow>
      <SettingRow title="角色标题" description="助手的显示名称，在对话列表中展示">
        <Input
          aria-label="角色标题"
          value={form.title}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="请输入角色标题"
        />
      </SettingRow>
      <SettingRow title="角色描述" description="简要描述助手的用途、特点或背景信息">
        <Textarea
          aria-label="角色描述"
          className="min-h-20"
          value={form.description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="请输入角色描述"
        />
      </SettingRow>
      <SettingRow title="分组设置" description="将助手归类到不同分组，便于管理和查找">
        <Select
          ariaLabel="分组设置"
          value={form.groupId}
          placeholder="请选择分组"
          options={[
            { value: "", label: "请选择分组" },
            ...groups.map((group) => ({ value: group.id, label: group.name })),
          ]}
          onValueChange={(groupId) => onChange({ groupId })}
        />
      </SettingRow>
    </div>
  );
}

function PromptTab({ form, onChange }: { form: CharacterFormState; onChange: (patch: Partial<CharacterFormState>) => void }) {
  return (
    <div className="space-y-5">
      <label className="flex items-center gap-2 text-sm">
        <Switch
          ariaLabel="使用 User Role 发送角色设定"
          checked={form.useUserPrompt}
          onCheckedChange={(useUserPrompt) => onChange({ useUserPrompt })}
        />
        使用 User Role 发送角色设定
      </label>
      <label className="block text-sm font-medium">
        系统提示词
        <Textarea
          className="mt-2 min-h-[320px]"
          value={form.systemPrompt}
          onChange={(event) => onChange({ systemPrompt: event.target.value })}
          placeholder="请输入角色设定、回复风格和工作要求"
        />
      </label>
    </div>
  );
}

function ModelTab({
  form,
  models,
  onChange,
}: {
  form: CharacterFormState;
  models: ReturnType<typeof flattenTextModels>;
  onChange: (patch: Partial<CharacterFormState>) => void;
}) {
  return (
    <div className="space-y-7">
      <SettingRow title="模型选择" description="不选择时使用系统默认模型，新会话会继承此配置">
        <Select
          ariaLabel="模型选择"
          value={form.modelId}
          placeholder="使用默认模型"
          options={[
            { value: "", label: "使用默认模型" },
            ...models.map(({ provider, model }) => ({
              value: model.id,
              label: `${provider.name} / ${model.modelName}`,
            })),
          ]}
          onValueChange={(modelId) => onChange({ modelId })}
        />
      </SettingRow>
      <label className="flex items-center gap-2 text-sm">
        <Switch
          ariaLabel="覆盖模型参数"
          checked={form.overrideModelParams}
          onCheckedChange={(overrideModelParams) => onChange({ overrideModelParams })}
        />
        覆盖模型参数
      </label>
      {form.overrideModelParams ? (
        <div className="grid gap-4 md:grid-cols-3">
          <OptionalNumber
            label="Temperature"
            value={form.modelTemperature}
            min={0}
            max={1.9}
            step={0.1}
            onChange={(value) => onChange({ modelTemperature: value })}
          />
          <OptionalNumber
            label="Top P"
            value={form.modelTopP}
            min={0}
            max={1}
            step={0.05}
            onChange={(value) => onChange({ modelTopP: value })}
          />
          <OptionalNumber
            label="Frequency Penalty"
            value={form.modelFrequencyPenalty}
            min={-1.9}
            max={1.9}
            step={0.1}
            onChange={(value) => onChange({ modelFrequencyPenalty: value })}
          />
        </div>
      ) : null}
    </div>
  );
}

function MemoryTab({ form, onChange }: { form: CharacterFormState; onChange: (patch: Partial<CharacterFormState>) => void }) {
  const tokenLimit = formatTokenLimit(form.memory.maxTokensLimit);
  const patchMemory = (memoryPatch: Partial<CharacterFormState["memory"]>) =>
    onChange({ memory: { ...form.memory, ...memoryPatch } });

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <OptionalNumber
        label="最大记忆轮数"
        value={form.memory.maxMemoryLength}
        min={2}
        max={500}
        step={1}
        nullLabel="No Limit"
        onChange={(value) => patchMemory({ maxMemoryLength: value })}
      />
      <label className="block text-sm font-medium">
        Token 上限
        <Input
          className="mt-2"
          value={tokenLimit}
          placeholder="例如 128K / 1M，留空为不限"
          onChange={(event) => patchMemory({ maxTokensLimit: parseTokenLimit(event.target.value) })}
        />
      </label>
      <NumberInput
        label="压缩触发比例"
        value={form.memory.compressionTriggerRatio}
        min={0.5}
        max={0.95}
        step={0.05}
        onChange={(value) => patchMemory({ compressionTriggerRatio: value })}
      />
      <NumberInput
        label="压缩目标比例"
        value={form.memory.compressionTargetRatio}
        min={0.2}
        max={0.8}
        step={0.05}
        onChange={(value) => patchMemory({ compressionTargetRatio: value })}
      />
      <label className="block text-sm font-medium">
        摘要模式
        <Select
          className="mt-2"
          ariaLabel="摘要模式"
          value={form.memory.summaryMode}
          options={[
            { value: "disabled", label: "disabled" },
            { value: "fast", label: "fast" },
            { value: "memory_sync", label: "memory_sync" },
          ]}
          onValueChange={(summaryMode) =>
            patchMemory({ summaryMode: summaryMode as CharacterFormState["memory"]["summaryMode"] })
          }
        />
      </label>
    </div>
  );
}

function LocalToolsTab({
  form,
  plugins,
  onChange,
  onOpenConfig,
}: {
  form: CharacterFormState;
  plugins: CharacterPluginDefinition[];
  onChange: (patch: Partial<CharacterFormState>) => void;
  onOpenConfig: (plugin: CharacterPluginDefinition) => void;
}) {
  return (
    <div className="space-y-5">
      <label className="flex items-center gap-2 text-sm">
        <Switch
          ariaLabel="自动启用全部工具"
          checked={form.toolsAuto}
          onCheckedChange={(toolsAuto) => onChange({ toolsAuto })}
        />
        自动启用全部工具
      </label>
      <div className="grid gap-3 md:grid-cols-3">
        {plugins.map((plugin) => {
          const value = form.toolSettings[plugin.pluginId];
          const enabled = form.toolsAuto || value === true || Array.isArray(value);
          return (
            <div key={plugin.pluginId} className="rounded-xl border border-slate-200 p-3 dark:border-[#2f3136]">
              <label className="flex items-center justify-between gap-2 text-sm font-semibold">
                {plugin.displayName}
                <Switch
                  ariaLabel={plugin.displayName}
                  disabled={form.toolsAuto}
                  checked={enabled}
                  onCheckedChange={(checked) =>
                    onChange({
                      toolSettings: { ...form.toolSettings, [plugin.pluginId]: checked },
                    })
                  }
                />
              </label>
              <p className="mt-2 line-clamp-2 min-h-8 text-xs text-muted-foreground">
                {plugin.description || "暂无描述"}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                disabled={form.toolsAuto}
                onClick={() => onOpenConfig(plugin)}
              >
                配置子工具
              </Button>
            </div>
          );
        })}
        {plugins.length === 0 ? <p className="text-sm text-muted-foreground">暂无可配置本地工具</p> : null}
      </div>
    </div>
  );
}

function McpToolsTab({ form, servers, onChange }: { form: CharacterFormState; servers: McpServer[]; onChange: (patch: Partial<CharacterFormState>) => void }) {
  return (
    <div className="space-y-5">
      <label className="flex items-center gap-2 text-sm">
        <Switch
          ariaLabel="自动启用全部 MCP 服务器"
          checked={form.mcpAuto}
          onCheckedChange={(mcpAuto) => onChange({ mcpAuto })}
        />
        自动启用全部 MCP 服务器
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        {servers.map((server) => (
          <label key={server.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm dark:border-[#2f3136]">
            <span>
              <span className="block font-semibold">{server.name}</span>
              <span className="text-xs text-muted-foreground">{server.description || "运行中的 MCP 服务器"}</span>
            </span>
            <Switch
              ariaLabel={server.name}
              disabled={form.mcpAuto}
              checked={form.mcpAuto || form.selectedMcpServerIds.includes(server.id)}
              onCheckedChange={(checked) => {
                const next = checked
                  ? [...form.selectedMcpServerIds, server.id]
                  : form.selectedMcpServerIds.filter((id) => id !== server.id);
                onChange({ selectedMcpServerIds: next });
              }}
            />
          </label>
        ))}
        {servers.length === 0 ? <p className="text-sm text-muted-foreground">暂无已启用 MCP 服务器</p> : null}
      </div>
    </div>
  );
}

function SkillsTab({ form, skills, onChange }: { form: CharacterFormState; skills: SkillOption[]; onChange: (patch: Partial<CharacterFormState>) => void }) {
  return (
    <div className="space-y-5">
      <label className="flex items-center gap-2 text-sm">
        <Switch
          ariaLabel="自动启用全部 Skills"
          checked={form.skillsAuto}
          onCheckedChange={(skillsAuto) => onChange({ skillsAuto })}
        />
        自动启用全部 Skills
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        {skills.map((skill) => {
          const enabled = form.skillsAuto || form.skillSettings[skill.id] === true;
          const skillTitle = skill.displayName || skill.name || skill.id;
          return (
            <label key={skill.id} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-[#2f3136]">
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold">{skillTitle}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <Switch
                    ariaLabel={skillTitle}
                    disabled={form.skillsAuto}
                    checked={enabled}
                    onCheckedChange={(checked) =>
                      onChange({ skillSettings: { ...form.skillSettings, [skill.id]: checked } })
                    }
                  />
                  {skill.builtIn ? (
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-600 dark:bg-green-500/10 dark:text-green-300">
                      内置
                    </span>
                  ) : null}
                  {skill.version ? (
                    <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-muted-foreground dark:border-[#3a3c42]">
                      {formatSkillVersion(skill.version)}
                    </span>
                  ) : null}
                </span>
              </span>
              <span className="mt-2 block line-clamp-2 min-h-8 text-xs text-muted-foreground">
                {skill.description || "暂无描述"}
              </span>
            </label>
          );
        })}
        {skills.length === 0 ? <p className="text-sm text-muted-foreground">暂无可用 Skills</p> : null}
      </div>
    </div>
  );
}

function formatSkillVersion(version: string): string {
  return version.startsWith("v") ? version : `v${version}`;
}

function SettingRow({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-4 border-b border-slate-100 pb-6 last:border-b-0 md:grid-cols-[220px_1fr] dark:border-[#2f3136]">
      <div>
        <h3 className="text-sm font-bold">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

function NumberInput({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <Input
        aria-label={label}
        className="mt-2"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function OptionalNumber({
  label,
  value,
  min,
  max,
  step,
  nullLabel = "Auto",
  onChange,
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  step: number;
  nullLabel?: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className="block text-sm font-medium">
      <div className="flex items-center justify-between">
        {label}
        <button type="button" className="text-xs text-pink-500" onClick={() => onChange(null)}>
          {nullLabel}
        </button>
      </div>
      <Input
        aria-label={label}
        className="mt-2"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        placeholder={nullLabel}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
      />
    </div>
  );
}

function AvatarCropDialog({
  sourceUrl,
  zoom,
  onZoomChange,
  onCancel,
  onConfirm,
}: {
  sourceUrl: string;
  zoom: number;
  onZoomChange: (value: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-80 grid place-items-center bg-black/45 px-4">
      <div role="dialog" aria-label="裁剪头像" className="w-full max-w-[420px] rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-bold">裁剪头像</h3>
        <div className="mt-4 grid place-items-center">
          <div className="h-64 w-64 overflow-hidden rounded-xl bg-slate-100">
            <img
              src={sourceUrl}
              alt=""
              className="h-full w-full object-cover"
              style={{ transform: `scale(${zoom})` }}
            />
          </div>
        </div>
        <label className="mt-4 block text-sm">
          缩放
          <input
            type="range"
            min={1}
            max={2}
            step={0.05}
            value={zoom}
            className="mt-2 w-full"
            onChange={(event) => onZoomChange(Number(event.target.value))}
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            取消
          </Button>
          <Button className="bg-pink-500 text-white shadow-none hover:bg-pink-500/90" onClick={onConfirm}>
            确认裁剪
          </Button>
        </div>
      </div>
    </div>
  );
}

function ToolConfigDialog({
  plugin,
  current,
  onClose,
  onSave,
}: {
  plugin: CharacterPluginDefinition;
  current: boolean | string[] | undefined;
  onClose: () => void;
  onSave: (enabledToolNames: string[], autoEnableAll: boolean) => void;
}) {
  const toolNames = (plugin.tools ?? []).map((tool) => tool.name);
  const initialSelected = current === true ? toolNames : Array.isArray(current) ? current : [];
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [autoEnableAll, setAutoEnableAll] = useState(current === true);

  return (
    <div className="fixed inset-0 z-80 grid place-items-center bg-black/45 px-4">
      <div role="dialog" aria-label={`${plugin.displayName} 子工具配置`} className="w-full max-w-[520px] rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-bold">{plugin.displayName} 子工具配置</h3>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <Switch
            ariaLabel="启动全部子工具（新增子工具自动启用）"
            checked={autoEnableAll}
            onCheckedChange={(checked) => {
              setAutoEnableAll(checked);
              if (checked) setSelected(toolNames);
            }}
          />
          启动全部子工具（新增子工具自动启用）
        </label>
        <div className="mt-4 space-y-2">
          {(plugin.tools ?? []).map((tool) => (
            <label key={tool.name} className="flex items-center justify-between rounded-lg border border-slate-200 p-2 text-sm">
              <span>
                <span className="block font-medium">{tool.displayName || tool.name}</span>
                <span className="text-xs text-muted-foreground">{tool.description || "暂无描述"}</span>
              </span>
              <Switch
                ariaLabel={tool.displayName || tool.name}
                checked={selected.includes(tool.name)}
                onCheckedChange={(checked) => {
                  setSelected((currentSelected) =>
                    checked
                      ? [...currentSelected, tool.name]
                      : currentSelected.filter((name) => name !== tool.name),
                  );
                }}
              />
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button className="bg-pink-500 text-white shadow-none hover:bg-pink-500/90" onClick={() => onSave(selected, autoEnableAll)}>
            保存子工具
          </Button>
        </div>
      </div>
    </div>
  );
}

function createObjectUrl(file: File): string {
  if (typeof URL !== "undefined" && "createObjectURL" in URL) {
    return URL.createObjectURL(file);
  }
  return "";
}

async function cropSquareImage(file: File, zoom: number): Promise<File> {
  if (typeof document === "undefined") return file;
  if (typeof URL === "undefined" || !("createObjectURL" in URL)) return file;

  const bitmap = await loadImageBitmap(file);
  if (!bitmap) return file;

  const size = Math.min(bitmap.width, bitmap.height) / zoom;
  const sourceX = Math.max(0, (bitmap.width - size) / 2);
  const sourceY = Math.max(0, (bitmap.height - size) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, sourceX, sourceY, size, size, 0, 0, 512, 512);

  const blob = await new Promise<Blob | null>((resolve) => {
    if (!canvas.toBlob) {
      resolve(null);
      return;
    }
    canvas.toBlob(resolve, "image/png", 0.95);
  });

  return blob ? new File([blob], file.name, { type: "image/png" }) : file;
}

function loadImageBitmap(file: File): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = window.setTimeout(() => resolve(null), 100);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = createObjectUrl(file);
  });
}

export default CharacterModal;
