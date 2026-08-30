import { useEffect, useState } from "react";
import { Bot, ChevronDown, ExternalLink, Plus, X } from "lucide-react";
import {
  mosaicApi,
  type ApiClient,
  type BotConfigField,
  type BotInstance,
  type BotPlatformMetadata,
} from "@mosaic-dock/api-client";
import type { Character, KnowledgeBase, ModelProvider } from "@mosaic-dock/shared";
import { WorkspacePageHeader } from "../../../components/layout/WorkspacePageHeader";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Spinner } from "../../../components/ui/spinner";
import { Switch } from "../../../components/ui/switch";
import { cn } from "../../../lib/utils";

export interface BotsManagementPageApi {
  client: Pick<
    ApiClient,
    | "fetchBotInstances"
    | "fetchBotPlatforms"
    | "fetchCharacters"
    | "fetchModels"
    | "fetchKnowledgeBases"
    | "createBotInstance"
  >;
}

interface BotsManagementPageProps {
  api?: BotsManagementPageApi;
}

export function BotsManagementPage({ api = mosaicApi }: BotsManagementPageProps) {
  const [bots, setBots] = useState<BotInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadBots() {
      setLoading(true);
      setError(null);
      try {
        const response = await api.client.fetchBotInstances();
        if (!cancelled) {
          setBots(Array.isArray(response) ? response : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "机器人加载失败");
          setBots([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadBots();

    return () => {
      cancelled = true;
    };
  }, [api]);

  async function reloadBots() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.client.fetchBotInstances();
      setBots(Array.isArray(response) ? response : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "机器人加载失败");
      setBots([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] px-5 pb-5 text-foreground dark:bg-[#1e1f23] dark:text-[#e8e9ed]">
      <header className="border-b border-slate-200 pb-4 dark:border-[#2f3136]">
        <WorkspacePageHeader title="机器人" />
        <div className="flex items-center justify-between gap-4">
          <nav aria-label="机器人页面" className="flex items-center gap-6 text-sm">
            <TabButton active>机器人管理</TabButton>
            <TabButton>对话数据</TabButton>
          </nav>
          <a
            href="https://ai.dingd.cn/docs/bot"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs text-muted-foreground transition hover:text-foreground dark:border-[#2f3136] dark:bg-[#232428]"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            使用说明
          </a>
        </div>
      </header>

      <main className="pt-5">
        <Button
          className="h-8 rounded-md bg-linear-to-r from-pink-500 to-rose-500 px-3 text-sm text-white shadow-none hover:from-pink-500/90 hover:to-rose-500/90"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          新建机器人
        </Button>

        <section className="mt-5">
          {loading ? (
            <div className="grid min-h-[220px] place-items-center">
              <Spinner label="正在加载机器人" />
            </div>
          ) : error ? (
            <BotsEmptyState title={error} description="请稍后重试或检查登录状态" />
          ) : bots.length === 0 ? (
            <BotsEmptyState title="暂无机器人" description="点击上方按钮创建第一个机器人" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {bots.map((bot) => (
                <BotCard key={bot.id} bot={bot} />
              ))}
            </div>
          )}
        </section>
      </main>
      {createDialogOpen ? (
        <BotCreateDialog
          api={api}
          onClose={() => setCreateDialogOpen(false)}
          onSaved={() => {
            setCreateDialogOpen(false);
            void reloadBots();
          }}
        />
      ) : null}
    </div>
  );
}

interface BotCreateDialogProps {
  api: BotsManagementPageApi;
  onClose: () => void;
  onSaved: () => void;
}

interface BotFormState {
  platform: string;
  name: string;
  defaultCharacterId: string;
  defaultModelId: string;
  knowledgeBaseIds: string[];
  platformConfig: Record<string, unknown>;
  reconnectEnabled: boolean;
  maxRetries: number;
  retryInterval: number;
  autoStart: boolean;
}

function BotCreateDialog({ api, onClose, onSaved }: BotCreateDialogProps) {
  const [form, setForm] = useState<BotFormState>(() => createEmptyBotForm());
  const [platforms, setPlatforms] = useState<BotPlatformMetadata[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [modelProviders, setModelProviders] = useState<ModelProvider[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedPlatform = platforms.find((platform) => platform.platform === form.platform);
  const modelOptions = flattenModels(modelProviders);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      setLoadingOptions(true);
      try {
        const [platformResponse, characterResponse, modelResponse, knowledgeBaseResponse] = await Promise.all([
          api.client.fetchBotPlatforms(),
          api.client.fetchCharacters(),
          api.client.fetchModels(),
          api.client.fetchKnowledgeBases(),
        ]);
        if (cancelled) return;
        setPlatforms(platformResponse);
        setCharacters(characterResponse.items ?? []);
        setModelProviders(modelResponse.items ?? []);
        setKnowledgeBases(knowledgeBaseResponse.items ?? []);
      } catch (loadError) {
        if (!cancelled) {
          setFormError(loadError instanceof Error ? loadError.message : "加载机器人配置失败");
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, [api]);

  function patchForm(patch: Partial<BotFormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function selectPlatform(platform: string) {
    const metadata = platforms.find((item) => item.platform === platform);
    patchForm({
      platform,
      platformConfig: createDefaultPlatformConfig(metadata?.fields ?? []),
    });
  }

  function setPlatformConfigValue(key: string, value: unknown) {
    setForm((current) => ({
      ...current,
      platformConfig: {
        ...current.platformConfig,
        [key]: value,
      },
    }));
  }

  function toggleKnowledgeBase(knowledgeBaseId: string) {
    if (!knowledgeBaseId) return;
    setForm((current) => ({
      ...current,
      knowledgeBaseIds: current.knowledgeBaseIds.includes(knowledgeBaseId)
        ? current.knowledgeBaseIds.filter((id) => id !== knowledgeBaseId)
        : [...current.knowledgeBaseIds, knowledgeBaseId],
    }));
  }

  async function submit() {
    const validationError = validateBotForm(form, selectedPlatform);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await api.client.createBotInstance({
        platform: form.platform,
        name: form.name,
        defaultCharacterId: form.defaultCharacterId,
        defaultModelId: form.defaultModelId || undefined,
        platformConfig: form.platformConfig,
        reconnectConfig: {
          enabled: form.reconnectEnabled,
          maxRetries: form.maxRetries,
          retryInterval: form.retryInterval,
        },
        autoStart: form.autoStart,
        additionalKwargs: {
          knowledgeBaseIds: form.knowledgeBaseIds.length > 0 ? form.knowledgeBaseIds : undefined,
        },
      });
      onSaved();
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "创建机器人失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-white/70 backdrop-blur-sm dark:bg-black/45">
      <section
        role="dialog"
        aria-label="创建机器人"
        className="flex max-h-[86vh] w-[min(600px,calc(100vw-32px))] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#34363c] dark:bg-[#232428]"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-[#34363c]">
          <h2 className="text-lg font-semibold">创建机器人</h2>
          <button
            type="button"
            aria-label="关闭"
            className="rounded-md p-1 text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
          {loadingOptions ? (
            <div className="grid min-h-60 place-items-center">
              <Spinner label="正在加载机器人配置" />
            </div>
          ) : (
            <div className="space-y-4">
              <BotFormRow label="选择平台" required>
                <Select
                  ariaLabel="选择平台"
                  value={form.platform}
                  placeholder="请选择平台"
                  options={platforms.map((platform) => ({
                    value: platform.platform,
                    label: platform.displayName,
                  }))}
                  disabled={submitting}
                  onValueChange={selectPlatform}
                />
                <a
                  href={getConfigDocUrl(form.platform)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-xs font-medium text-pink-500 hover:text-pink-600"
                >
                  {selectedPlatform ? `查看${selectedPlatform.displayName}配置教程` : "查看配置教程"}
                </a>
              </BotFormRow>

              <BotFormRow label="机器人名称" required>
                <Input
                  aria-label="机器人名称"
                  maxLength={50}
                  placeholder="请输入机器人名称"
                  value={form.name}
                  disabled={submitting}
                  onChange={(event) => patchForm({ name: event.target.value })}
                />
              </BotFormRow>

              <BotFormRow label="默认角色" required description="机器人接收消息后使用该角色进行对话">
                <Select
                  ariaLabel="默认角色"
                  value={form.defaultCharacterId}
                  placeholder="请选择默认角色"
                  options={characters.map((character) => ({
                    value: character.id,
                    label: character.title,
                  }))}
                  disabled={submitting}
                  onValueChange={(defaultCharacterId) => patchForm({ defaultCharacterId })}
                />
              </BotFormRow>

              <BotFormRow
                label="模型选择"
                description="不选择则使用角色的默认模型，如果角色未设置则使用全局默认模型"
              >
                <Select
                  ariaLabel="模型选择"
                  value={form.defaultModelId}
                  placeholder="继承自角色/全局设置"
                  options={[{ value: "", label: "继承自角色/全局设置" }, ...modelOptions]}
                  disabled={submitting}
                  onValueChange={(defaultModelId) => patchForm({ defaultModelId })}
                />
              </BotFormRow>

              <BotFormRow label="引用知识库" description="AI回复时会引用这些知识库的内容">
                <Select
                  ariaLabel="引用知识库"
                  value={form.knowledgeBaseIds.at(-1) ?? ""}
                  placeholder="请选择知识库（可多选）"
                  options={knowledgeBases.map((knowledgeBase) => ({
                    value: knowledgeBase.id,
                    label: knowledgeBase.name,
                  }))}
                  disabled={submitting}
                  onValueChange={toggleKnowledgeBase}
                />
                {form.knowledgeBaseIds.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {form.knowledgeBaseIds.map((knowledgeBaseId) => {
                      const knowledgeBase = knowledgeBases.find((item) => item.id === knowledgeBaseId);
                      return (
                        <button
                          key={knowledgeBaseId}
                          type="button"
                          className="rounded-full bg-pink-50 px-2 py-1 text-xs text-pink-600 dark:bg-pink-500/10 dark:text-pink-300"
                          onClick={() => toggleKnowledgeBase(knowledgeBaseId)}
                        >
                          {knowledgeBase?.name ?? knowledgeBaseId} ×
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </BotFormRow>

              {selectedPlatform ? (
                <div className="border-t border-slate-100 pt-4 dark:border-[#34363c]">
                  <h3 className="mb-3 text-sm font-semibold">平台配置</h3>
                  <div className="space-y-4">
                    {selectedPlatform.fields.map((field) => (
                      <PlatformField
                        key={field.key}
                        field={field}
                        value={form.platformConfig[field.key]}
                        disabled={submitting}
                        onChange={(value) => setPlatformConfigValue(field.key, value)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="border-t border-slate-100 pt-4 dark:border-[#34363c]">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left text-sm font-semibold"
                  onClick={() => setAdvancedOpen((current) => !current)}
                >
                  <span className="inline-flex items-center gap-2">
                    高级配置
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-muted-foreground dark:bg-[#2a2c30]">
                      可选
                    </span>
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", advancedOpen ? "rotate-180" : "")} />
                </button>
                {advancedOpen ? (
                  <div className="mt-4 space-y-4">
                    <BotSwitchRow
                      label="启用重连"
                      checked={form.reconnectEnabled}
                      disabled={submitting}
                      onChange={(reconnectEnabled) => patchForm({ reconnectEnabled })}
                    />
                    {form.reconnectEnabled ? (
                      <>
                        <BotFormRow label="最大重试次数">
                          <Input
                            aria-label="最大重试次数"
                            type="number"
                            min={1}
                            max={20}
                            value={form.maxRetries}
                            onChange={(event) => patchForm({ maxRetries: Number(event.target.value) })}
                          />
                        </BotFormRow>
                        <BotFormRow label="重试间隔(ms)">
                          <Input
                            aria-label="重试间隔(ms)"
                            type="number"
                            min={1000}
                            max={60000}
                            step={1000}
                            value={form.retryInterval}
                            onChange={(event) => patchForm({ retryInterval: Number(event.target.value) })}
                          />
                        </BotFormRow>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <BotSwitchRow
                label="自动启动"
                description="创建后立即启动机器人"
                checked={form.autoStart}
                disabled={submitting}
                onChange={(autoStart) => patchForm({ autoStart })}
              />

              {formError ? <p className="text-sm text-red-500">{formError}</p> : null}
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-[#34363c]">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button
            className="bg-pink-500 text-white hover:bg-pink-600"
            disabled={loadingOptions || submitting}
            onClick={() => void submit()}
          >
            {submitting ? "创建中..." : "创建"}
          </Button>
        </footer>
      </section>
    </div>
  );
}

function createEmptyBotForm(): BotFormState {
  return {
    platform: "",
    name: "",
    defaultCharacterId: "",
    defaultModelId: "",
    knowledgeBaseIds: [],
    platformConfig: {},
    reconnectEnabled: true,
    maxRetries: 5,
    retryInterval: 5000,
    autoStart: false,
  };
}

function createDefaultPlatformConfig(fields: BotConfigField[]): Record<string, unknown> {
  return fields.reduce<Record<string, unknown>>((config, field) => {
    if (typeof field.defaultValue !== "undefined") {
      config[field.key] = field.defaultValue;
    }
    return config;
  }, {});
}

function validateBotForm(form: BotFormState, platform?: BotPlatformMetadata): string | null {
  if (!form.platform) return "请选择平台";
  if (!form.name.trim()) return "请输入机器人名称";
  if (!form.defaultCharacterId) return "请选择默认角色";

  const missingField = platform?.fields.find((field) => {
    if (!field.required) return false;
    const value = form.platformConfig[field.key];
    return value === undefined || value === null || value === "";
  });
  if (missingField) return `请输入${missingField.label}`;

  return null;
}

function flattenModels(providers: ModelProvider[]): { value: string; label: string }[] {
  return providers.flatMap((provider) =>
    (provider.models ?? [])
      .filter((model) => model.isActive)
      .map((model) => ({
        value: model.id,
        label: `${provider.name} / ${model.modelName}`,
      })),
  );
}

function getConfigDocUrl(platform: string): string {
  return platform ? `https://ai.dingd.cn/docs/bot/${platform}` : "https://ai.dingd.cn/docs/bot/start";
}

function BotFormRow({
  label,
  required = false,
  description,
  children,
}: {
  label: string;
  required?: boolean;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[104px_1fr] sm:items-start">
      <label className="pt-2 text-right text-sm text-slate-600 dark:text-slate-300">
        {required ? <span className="mr-1 text-pink-500">*</span> : null}
        {label}
      </label>
      <div>
        {children}
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}

function BotSwitchRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[104px_1fr] sm:items-start">
      <span className="pt-0.5 text-right text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <div className="flex items-center gap-2">
        <Switch ariaLabel={label} checked={checked} disabled={disabled} onCheckedChange={onChange} />
        {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
      </div>
    </div>
  );
}

function PlatformField({
  field,
  value,
  disabled,
  onChange,
}: {
  field: BotConfigField;
  value: unknown;
  disabled?: boolean;
  onChange: (value: unknown) => void;
}) {
  if (field.type === "boolean") {
    return (
      <BotSwitchRow
        label={field.label}
        description={field.description}
        checked={Boolean(value)}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  if (field.type === "select") {
    return (
      <BotFormRow label={field.label} required={field.required} description={field.description}>
        <Select
          ariaLabel={field.label}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          options={(field.options ?? []).map((option) => ({ value: option.value, label: option.label }))}
          disabled={disabled}
          onValueChange={onChange}
        />
      </BotFormRow>
    );
  }

  return (
    <BotFormRow label={field.label} required={field.required} description={field.description}>
      <Input
        aria-label={field.label}
        type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
        placeholder={field.placeholder}
        value={typeof value === "string" || typeof value === "number" ? value : ""}
        disabled={disabled}
        onChange={(event) => {
          onChange(field.type === "number" ? Number(event.target.value) : event.target.value);
        }}
      />
    </BotFormRow>
  );
}

function TabButton({ active = false, children }: { active?: boolean; children: string }) {
  return (
    <button
      type="button"
      className={cn(
        "border-b-2 pb-2 transition-colors",
        active
          ? "border-pink-500 text-pink-500"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function BotsEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid min-h-[260px] place-items-center text-center">
      <div className="flex flex-col items-center">
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white dark:border-[#2f3136] dark:bg-[#232428]">
          <Bot className="h-6 w-6 text-foreground" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-sm font-medium text-foreground">{title}</h2>
        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function BotCard({ bot }: { bot: BotInstance }) {
  const statusText = bot.runtimeStatus ?? bot.status;

  return (
    <article
      data-testid={`bot-card-${bot.id}`}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] dark:border-[#2f3136] dark:bg-[#232428]"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-[#2a2c30] dark:text-[#e8e9ed]">
          <Bot className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold">{bot.name}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{bot.platform}</p>
            </div>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                bot.enabled
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "bg-slate-100 text-muted-foreground dark:bg-[#2a2c30]",
              )}
            >
              {bot.enabled ? "已启用" : "已停用"}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-[#2a2c30]">
              状态：{statusText}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-[#2a2c30]">
              重试：{bot.maxRetries} 次
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export default BotsManagementPage;
