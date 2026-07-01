import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Eye, EyeOff, Plus, Settings, Star, Trash2, X } from "lucide-react";
import { mosaicApi, type ApiClient } from "@mosaic-dock/api-client";
import type { Model, ModelProvider } from "@mosaic-dock/shared";
import { WorkspacePageHeader } from "../../components/layout/WorkspacePageHeader";
import { EmptyState } from "../../components/ui/empty-state";
import { Spinner } from "../../components/ui/spinner";
import { cn } from "../../lib/utils";

export interface ModelsPageApi {
  client: Pick<
    ApiClient,
    | "fetchAllModels"
    | "createProvider"
    | "testProviderConnection"
    | "updateProvider"
    | "deleteProvider"
    | "fetchRemoteModels"
    | "createModel"
    | "updateModel"
    | "deleteModel"
    | "toggleModelActive"
    | "toggleModelFavorite"
  >;
}

interface ModelsPageProps {
  api?: ModelsPageApi;
}

type DisplayProvider = ModelProvider & {
  description?: string;
};

type RemoteModelItem = {
  modelName: string;
  modelType: string;
  config?: Record<string, unknown>;
};

const protocolOptions = [
  { value: "openai", label: "OpenAI" },
  { value: "openai-response", label: "OpenAI-Response" },
  { value: "gemini", label: "Gemini" },
  { value: "anthropic", label: "Anthropic" },
];

const maskedApiKey = "••••••••••••••••••••••••••••••••";

const providerTemplates: DisplayProvider[] = [
  providerTemplate("custom", "Custom", "openai", "自定义供应商，支持所有协议、直接使用基础适配器。"),
  providerTemplate("siliconflow", "硅基流动", "openai", "提供高性价比的开源模型 API 服务，支持多种主流大语言模型。", "siliconflow.svg"),
  providerTemplate("volcengine", "火山引擎", "openai-response", "字节跳动旗下云平台，提供豆包大模型及企业级 AI 解决方案。", "volcengine.svg"),
  providerTemplate("deepseek", "DeepSeek", "openai", "深度求索，以高性价比和强大的代码生成能力著称，支持深度思考模式。", "deepseek.svg"),
  providerTemplate("aliyun-bailian", "阿里云百炼", "openai", "阿里云推出的大模型服务平台，提供通义千问等自研模型及第三方模型接入。", "aliyun-bailian.svg"),
  providerTemplate("openai", "OpenAI", "openai", "全球领先的 AI 研究机构，ChatGPT 和 GPT 系列模型的创造者。", "openai.svg"),
  providerTemplate("openai-response", "OpenAI (Responses API)", "openai-response", "使用 OpenAI 最新 Responses API（beta），专为 o 系列推理模型和高级智能体场景设计。", "openai.svg"),
  providerTemplate("minimax", "MiniMax", "openai", "专注于通用人工智能，提供高质量的语言模型和语音合成服务。", "minimax.svg"),
  providerTemplate("baidu-qianfan", "百度智能云", "openai", "百度千帆大模型平台，提供文心一言系列模型及完整的 AI 开发生态。", "baidu-qianfan.svg"),
  providerTemplate("zhipu", "智谱 AI", "openai", "源自清华技术背景，提供 GLM 系列大语言模型，支持强大的推理与代码能力。", "zhipu.svg"),
  providerTemplate("moonshot", "Moonshot AI", "openai", "月之暗面科技，Kimi 智能助手背后的技术提供方，擅长长文本处理。"),
  providerTemplate("azure-openai", "Azure OpenAI", "openai", "微软 Azure 云平台提供的 OpenAI 服务，支持企业级部署和更高的安全性。", "azure-openai.svg"),
  providerTemplate("groq", "Groq", "openai", "以极致的推理速度著称，提供低延迟的大语言模型 API 服务。", "groq.svg"),
  providerTemplate("google", "Google", "gemini", "谷歌提供的 Gemini 大模型服务，具备强大的多模态理解与生成能力。", "google.svg"),
  providerTemplate("anthropic", "Anthropic", "anthropic", "Anthropic 的 Claude 系列模型，以安全和高质量对话著称。", "anthropic.svg"),
];

export function ModelsPage({ api = mosaicApi }: ModelsPageProps) {
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [modelManagementProvider, setModelManagementProvider] = useState<DisplayProvider | null>(null);
  const [settingsProvider, setSettingsProvider] = useState<DisplayProvider | null>(null);
  const [deleteProviderTarget, setDeleteProviderTarget] = useState<DisplayProvider | null>(null);
  const [deletingProvider, setDeletingProvider] = useState(false);
  const [deleteProviderError, setDeleteProviderError] = useState<string | null>(null);
  const [addingProviderId, setAddingProviderId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.client.fetchAllModels();
      setProviders(Array.isArray(response.items) ? response.items : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "模型供应商加载失败");
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    let cancelled = false;

    async function loadProviders() {
      setLoading(true);
      setError(null);
      try {
        const response = await api.client.fetchAllModels();
        if (!cancelled) {
          setProviders(Array.isArray(response.items) ? response.items : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "模型供应商加载失败");
          setProviders([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProviders();

    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 3000);
  }, []);

  const { addedProviders, availableProviders } = useMemo(() => {
    const addedProviders = providers.filter(isAddedProvider).map(mergeProviderTemplateMetadata);
    const addedProviderTypes = new Set(addedProviders.map((provider) => provider.provider ?? provider.id));
    const availableProviders = providerTemplates.filter((template) => !addedProviderTypes.has(template.id));

    return { addedProviders, availableProviders };
  }, [providers]);

  const handleAddTemplateProvider = async (provider: DisplayProvider) => {
    const providerType = provider.provider ?? provider.id;
    if (providerType === "custom") {
      setCustomDialogOpen(true);
      return;
    }

    setAddingProviderId(provider.id);
    setError(null);
    try {
      await api.client.createProvider({
        name: provider.name,
        provider: providerType,
        protocol: provider.protocol || "openai",
        apiUrl: "",
        apiKey: "",
      });
      await loadProviders();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "供应商添加失败");
    } finally {
      setAddingProviderId(null);
    }
  };

  const handleConfirmDeleteProvider = async () => {
    if (!deleteProviderTarget) return;
    setDeletingProvider(true);
    setDeleteProviderError(null);
    try {
      await api.client.deleteProvider(deleteProviderTarget.id);
      setDeleteProviderTarget(null);
      showToast("删除成功");
      await loadProviders();
    } catch (deleteError) {
      setDeleteProviderError(deleteError instanceof Error ? deleteError.message : "供应商删除失败");
    } finally {
      setDeletingProvider(false);
    }
  };

  useBodyScrollLock(Boolean(customDialogOpen || modelManagementProvider || settingsProvider || deleteProviderTarget));

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground dark:bg-[#1e1f23] dark:text-[#e8e9ed]">
      {toastMessage ? (
        <div
          role="status"
          className="fixed left-1/2 top-4 z-60 -translate-x-1/2 rounded-md bg-green-50 px-4 py-2 text-sm text-green-700 shadow-sm dark:bg-green-500/10 dark:text-green-300"
        >
          {toastMessage}
        </div>
      ) : null}
      <div className="px-4 sm:px-6">
        <WorkspacePageHeader
          title="模型管理"
          actions={
            <button
              type="button"
              onClick={() => setCustomDialogOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-pink-500 px-4 text-sm font-medium text-white shadow-sm hover:bg-pink-500/90"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              添加自定义
            </button>
          }
        />
      </div>

      <main className="flex-1 overflow-auto px-4 py-5 sm:px-6">
        <div className="mx-auto w-full max-w-[1040px]">
          <header className="mb-5 flex items-center justify-between py-1">
            <h2 className="text-lg font-semibold text-foreground">供应商列表</h2>
          </header>

          {loading ? (
            <div className="grid min-h-[280px] place-items-center">
              <Spinner label="正在加载模型供应商" />
            </div>
          ) : error ? (
            <EmptyState description={error} />
          ) : (
            <>
              <ProviderSection
                title="已添加的供应商"
                providers={addedProviders}
                variant="added"
                onManageModels={setModelManagementProvider}
                onEditSettings={setSettingsProvider}
                onDeleteProvider={(provider) => {
                  setDeleteProviderTarget(provider);
                  setDeleteProviderError(null);
                }}
              />
              <ProviderSection
                title="可添加的供应商"
                providers={availableProviders}
                variant="template"
                onAddProvider={handleAddTemplateProvider}
                addingProviderId={addingProviderId}
              />
            </>
          )}
        </div>
      </main>

      <CustomProviderDialog
        open={customDialogOpen}
        api={api}
        onClose={() => setCustomDialogOpen(false)}
        onSaved={() => {
          setCustomDialogOpen(false);
          void loadProviders();
        }}
      />
      <ModelManagementDialog
        provider={modelManagementProvider}
        api={api}
        onClose={() => setModelManagementProvider(null)}
        onChanged={() => {
          void loadProviders();
        }}
      />
      <ProviderSettingsDialog
        provider={settingsProvider}
        api={api}
        onClose={() => setSettingsProvider(null)}
        onChanged={() => {
          setSettingsProvider(null);
          showToast("保存成功");
          void loadProviders();
        }}
        onDeleted={() => {
          setSettingsProvider(null);
          void loadProviders();
        }}
      />
      <DeleteProviderDialog
        provider={deleteProviderTarget}
        busy={deletingProvider}
        error={deleteProviderError}
        onCancel={() => {
          if (deletingProvider) return;
          setDeleteProviderTarget(null);
          setDeleteProviderError(null);
        }}
        onConfirm={() => void handleConfirmDeleteProvider()}
      />
    </div>
  );
}

interface CustomProviderDialogProps {
  open: boolean;
  api: ModelsPageApi;
  onClose: () => void;
  onSaved: () => void;
}

interface CustomProviderForm {
  name: string;
  protocol: string;
  apiUrl: string;
  apiKey: string;
  headers: string;
}

const initialCustomProviderForm: CustomProviderForm = {
  name: "",
  protocol: "openai",
  apiUrl: "",
  apiKey: "",
  headers: "",
};

function CustomProviderDialog({ open, api, onClose, onSaved }: CustomProviderDialogProps) {
  const [form, setForm] = useState<CustomProviderForm>(initialCustomProviderForm);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(initialCustomProviderForm);
      setTesting(false);
      setSaving(false);
      setStatus(null);
    }
  }, [open]);

  if (!open) return null;

  const payload = () => {
    const name = form.name.trim();
    const apiUrl = form.apiUrl.trim();
    const apiKey = form.apiKey.trim();

    if (!name) throw new Error("请输入分组名字");
    if (!apiUrl) throw new Error("请输入 API 地址");
    if (!apiKey) throw new Error("请输入 API KEY");

    const headers = parseHeaderLines(form.headers);
    return {
      name,
      provider: "custom",
      protocol: form.protocol,
      apiUrl,
      apiKey,
      ...(headers ? { attributes: { headers } } : {}),
    };
  };

  const handleTest = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const { name, ...testPayload } = payload();
      void name;
      const result = await api.client.testProviderConnection(testPayload);
      setStatus({
        type: result.success ? "success" : "error",
        message: result.message || (result.success ? "连接成功" : "连接失败"),
      });
    } catch (testError) {
      setStatus({
        type: "error",
        message: testError instanceof Error ? testError.message : "连接测试失败",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await api.client.createProvider(payload());
      onSaved();
    } catch (saveError) {
      setStatus({
        type: "error",
        message: saveError instanceof Error ? saveError.message : "供应商保存失败",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overscroll-contain bg-white/70 px-4 backdrop-blur-[1px] dark:bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="新建分组"
        className="w-full max-w-[560px] rounded-xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-[#2f3137] dark:bg-[#232428]"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-[#e8e9ed]">新建分组</h2>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-[#2a2c30] dark:hover:text-[#e8e9ed]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4">
          <LabeledField label="名字" htmlFor="custom-provider-name">
            <input
              id="custom-provider-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="输入分组名字"
              className="h-10 w-full rounded border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-pink-400 dark:border-[#34363c] dark:bg-[#1f2024]"
            />
          </LabeledField>

          <LabeledField label="协议类型" htmlFor="custom-provider-protocol">
            <ProtocolSelect
              id="custom-provider-protocol"
              value={form.protocol}
              onChange={(protocol) => setForm((current) => ({ ...current, protocol }))}
            />
          </LabeledField>

          <LabeledField label="API地址" htmlFor="custom-provider-api-url">
            <input
              id="custom-provider-api-url"
              value={form.apiUrl}
              onChange={(event) => setForm((current) => ({ ...current, apiUrl: event.target.value }))}
              placeholder="api_url"
              className="h-10 w-full rounded border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-pink-400 dark:border-[#34363c] dark:bg-[#1f2024]"
            />
          </LabeledField>

          <LabeledField label="API KEY" htmlFor="custom-provider-api-key">
            <div className="flex gap-2">
              <input
                id="custom-provider-api-key"
                type="password"
                value={form.apiKey}
                onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
                placeholder="api_key"
                className="h-10 min-w-0 flex-1 rounded border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-pink-400 dark:border-[#34363c] dark:bg-[#1f2024]"
              />
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || saving}
                className="h-10 rounded bg-pink-500 px-5 text-sm font-medium text-white shadow-sm hover:bg-pink-500/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {testing ? "测试中..." : "测试"}
              </button>
            </div>
          </LabeledField>

          <LabeledField label="自定义请求头" htmlFor="custom-provider-headers" alignStart>
            <textarea
              id="custom-provider-headers"
              value={form.headers}
              onChange={(event) => setForm((current) => ({ ...current, headers: event.target.value }))}
              placeholder="每行一个请求头，格式为: Key: Value"
              rows={4}
              className="min-h-[112px] w-full resize-y rounded border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-pink-400 dark:border-[#34363c] dark:bg-[#1f2024]"
            />
            <p className="mt-1.5 text-xs leading-relaxed text-gray-500 dark:text-[#8b8d95]">
              用于 API Gateway 认证等场景，格式示例: Authorization: Bearer token
            </p>
          </LabeledField>
        </div>

        {status ? (
          <div
            className={cn(
              "mt-4 rounded px-3 py-2 text-sm",
              status.type === "success"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300",
            )}
          >
            {status.message}
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving || testing}
            className="h-9 rounded border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#34363c] dark:bg-[#2a2c30] dark:text-[#e8e9ed]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || testing}
            className="h-9 rounded bg-pink-500 px-4 text-sm font-medium text-white shadow-sm hover:bg-pink-500/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "保存中..." : "确定"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModelManagementDialog({
  provider,
  api,
  onClose,
  onChanged,
}: {
  provider: DisplayProvider | null;
  api: ModelsPageApi;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [addModelDialogOpen, setAddModelDialogOpen] = useState(false);
  const [remoteModels, setRemoteModels] = useState<RemoteModelItem[]>([]);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!provider) {
      setAddModelDialogOpen(false);
      setRemoteModels([]);
      setStatus(null);
      setBusy(false);
    }
  }, [provider]);

  if (!provider) return null;

  const runMutation = async (operation: () => Promise<unknown>, successMessage?: string) => {
    setBusy(true);
    setStatus(null);
    try {
      await operation();
      if (successMessage) {
        setStatus({ type: "success", message: successMessage });
      }
      onChanged();
    } catch (mutationError) {
      setStatus({
        type: "error",
        message: mutationError instanceof Error ? mutationError.message : "操作失败",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSyncRemoteModels = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const response = await api.client.fetchRemoteModels(provider.id);
      setRemoteModels(Array.isArray(response.items) ? response.items : []);
      setStatus({ type: "success", message: "远程模型已同步" });
    } catch (syncError) {
      setStatus({
        type: "error",
        message: syncError instanceof Error ? syncError.message : "远程模型同步失败",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleImportRemoteModel = async (model: RemoteModelItem) => {
    await runMutation(
      () =>
        api.client.createModel({
          providerId: provider.id,
          modelName: model.modelName,
          modelType: model.modelType || "text",
          config: model.config ?? {},
        }),
      "模型已导入",
    );
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overscroll-contain bg-white/70 px-4 backdrop-blur-[1px] dark:bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${provider.name} 模型管理`}
        className="max-h-[88vh] w-full max-w-[760px] overflow-auto overscroll-contain rounded-xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-[#2f3137] dark:bg-[#232428]"
      >
        <DialogHeader title={`${provider.name} 模型管理`} onClose={onClose} />

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSyncRemoteModels}
            disabled={busy}
            className="rounded bg-pink-500 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-pink-500/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            同步远程模型
          </button>
          <button
            type="button"
            onClick={() => setAddModelDialogOpen(true)}
            className="rounded border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-[#34363c] dark:bg-[#2a2c30] dark:text-[#e8e9ed]"
          >
            手动添加模型
          </button>
        </div>

        <ModelTable
          models={provider.models ?? []}
          busy={busy}
          onFavorite={(model) => runMutation(() => api.client.toggleModelFavorite(model.id))}
          onToggleActive={(model) => runMutation(() => api.client.toggleModelActive(model.id))}
          onDelete={(model) => runMutation(() => api.client.deleteModel(model.id))}
        />

        {remoteModels.length > 0 ? (
          <div className="mt-5">
            <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-[#d7d8dd]">远程模型</h3>
            <table className="w-full border-collapse text-sm">
              <tbody>
                {remoteModels.map((model) => (
                  <tr key={model.modelName} className="border-t border-gray-100 dark:border-[#34363c]">
                    <td className="py-2 font-medium text-gray-800 dark:text-[#e8e9ed]">{model.modelName}</td>
                    <td className="py-2 text-gray-500">{model.modelType}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleImportRemoteModel(model)}
                        disabled={busy}
                        className="rounded bg-pink-500 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        导入
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <DialogStatus status={status} />
        <AddModelDialog
          open={addModelDialogOpen}
          providerId={provider.id}
          busy={busy}
          onClose={() => setAddModelDialogOpen(false)}
          onSave={(data) =>
            runMutation(
              async () => {
                await api.client.createModel(data);
                setAddModelDialogOpen(false);
              },
              "模型已添加",
            )
          }
        />
      </div>
    </div>
  );
}

interface AddModelFormState {
  modelName: string;
  modelType: "text" | "embedding";
  inputText: boolean;
  inputImage: boolean;
  outputText: boolean;
  outputImage: boolean;
  toolCalling: boolean;
  thinking: boolean;
  contextWindow: string;
  maxOutputTokens: string;
  temperature: string;
  topP: string;
  frequencyPenalty: string;
  customJson: string;
}

const initialAddModelForm: AddModelFormState = {
  modelName: "",
  modelType: "text",
  inputText: true,
  inputImage: false,
  outputText: true,
  outputImage: false,
  toolCalling: false,
  thinking: false,
  contextWindow: "128000",
  maxOutputTokens: "4096",
  temperature: "",
  topP: "",
  frequencyPenalty: "",
  customJson: "{}",
};

function AddModelDialog({
  open,
  providerId,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  providerId: string;
  busy: boolean;
  onClose: () => void;
  onSave: (data: {
    providerId: string;
    modelName: string;
    modelType: string;
    config: Record<string, unknown>;
  }) => void;
}) {
  const [form, setForm] = useState<AddModelFormState>(initialAddModelForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(initialAddModelForm);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const update = <K extends keyof AddModelFormState>(key: K, value: AddModelFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = () => {
    const modelName = form.modelName.trim();
    if (!modelName) {
      setError("请输入模型名称");
      return;
    }

    try {
      const config = buildModelConfig(form);
      onSave({
        providerId,
        modelName,
        modelType: form.modelType,
        config,
      });
    } catch (configError) {
      setError(configError instanceof Error ? configError.message : "自定义参数格式不正确");
    }
  };

  return (
    <div className="fixed inset-0 z-60 grid place-items-center overscroll-contain bg-white/70 px-4 backdrop-blur-[1px] dark:bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="新增模型"
        className="max-h-[90vh] w-full max-w-[520px] overflow-auto overscroll-contain rounded-xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-[#2f3137] dark:bg-[#232428]"
      >
        <DialogHeader title="新增模型" onClose={onClose} />

        <div className="space-y-4">
          <LabeledField label="* 模型名称" htmlFor="add-model-name">
            <input
              id="add-model-name"
              value={form.modelName}
              onChange={(event) => update("modelName", event.target.value)}
              placeholder="例如：gpt-4o, qwen-max"
              className="h-9 w-full rounded border border-pink-300 bg-white px-3 text-sm outline-none transition focus:border-pink-400 dark:border-[#34363c] dark:bg-[#1f2024]"
            />
          </LabeledField>

          <LabeledField label="* 模型类型" htmlFor="add-model-type">
            <div id="add-model-type" className="flex gap-2">
              <SegmentButton active={form.modelType === "text"} onClick={() => update("modelType", "text")}>
                对话 (Chat)
              </SegmentButton>
              <SegmentButton active={form.modelType === "embedding"} onClick={() => update("modelType", "embedding")}>
                嵌入 (Embedding)
              </SegmentButton>
            </div>
          </LabeledField>

          <FeatureRow title="输入能力">
            <CheckPill checked={form.inputText} label="文本输入" onChange={(checked) => update("inputText", checked)} />
            <CheckPill checked={form.inputImage} label="图像输入" onChange={(checked) => update("inputImage", checked)} />
          </FeatureRow>

          <FeatureRow title="输出能力">
            <CheckPill checked={form.outputText} label="文本输出" onChange={(checked) => update("outputText", checked)} />
            <CheckPill checked={form.outputImage} label="图像输出" onChange={(checked) => update("outputImage", checked)} />
          </FeatureRow>

          <FeatureRow title="高级功能">
            <CheckPill checked={form.toolCalling} label="工具调用" onChange={(checked) => update("toolCalling", checked)} />
            <CheckPill checked={form.thinking} label="混合思考" onChange={(checked) => update("thinking", checked)} />
          </FeatureRow>

          <LabeledField label="上下文窗口" htmlFor="add-model-context-window">
            <TokenInput
              id="add-model-context-window"
              value={form.contextWindow}
              onChange={(value) => update("contextWindow", value)}
            />
          </LabeledField>

          <LabeledField label="最大输出长度" htmlFor="add-model-max-output">
            <TokenInput
              id="add-model-max-output"
              value={form.maxOutputTokens}
              onChange={(value) => update("maxOutputTokens", value)}
            />
            <p className="mt-1 text-xs text-gray-500">
              模型默认参数（除非你明确知道自己在干什么，否则请留空，由 API 自行决定）
            </p>
          </LabeledField>

          <LabeledField label="温度" htmlFor="add-model-temperature">
            <input
              id="add-model-temperature"
              type="number"
              value={form.temperature}
              onChange={(event) => update("temperature", event.target.value)}
              placeholder="模型默认"
              className="h-9 w-full rounded border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-pink-400 dark:border-[#34363c] dark:bg-[#1f2024]"
            />
          </LabeledField>

          <LabeledField label="Top P" htmlFor="add-model-top-p">
            <input
              id="add-model-top-p"
              type="number"
              value={form.topP}
              onChange={(event) => update("topP", event.target.value)}
              placeholder="模型默认"
              className="h-9 w-full rounded border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-pink-400 dark:border-[#34363c] dark:bg-[#1f2024]"
            />
          </LabeledField>

          <LabeledField label="频率惩罚" htmlFor="add-model-frequency-penalty">
            <input
              id="add-model-frequency-penalty"
              type="number"
              value={form.frequencyPenalty}
              onChange={(event) => update("frequencyPenalty", event.target.value)}
              placeholder="模型默认"
              className="h-9 w-full rounded border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-pink-400 dark:border-[#34363c] dark:bg-[#1f2024]"
            />
          </LabeledField>

          <LabeledField label="自定义参数(JSON)" htmlFor="add-model-custom-json" alignStart>
            <textarea
              id="add-model-custom-json"
              value={form.customJson}
              onChange={(event) => update("customJson", event.target.value)}
              rows={4}
              className="min-h-[92px] w-full resize-y rounded border border-gray-200 bg-white px-3 py-2 font-mono text-sm outline-none transition focus:border-pink-400 dark:border-[#34363c] dark:bg-[#1f2024]"
            />
          </LabeledField>
        </div>

        {error ? <DialogStatus status={{ type: "error", message: error }} /> : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-9 rounded border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#34363c] dark:bg-[#2a2c30] dark:text-[#e8e9ed]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="h-9 rounded bg-pink-500 px-4 text-sm font-medium text-white shadow-sm hover:bg-pink-500/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            保存更改
          </button>
        </div>
      </div>
    </div>
  );
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-3 py-1.5 text-sm font-medium transition",
        active ? "bg-pink-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[#2a2c30] dark:text-[#e8e9ed]",
      )}
    >
      {children}
    </button>
  );
}

function FeatureRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[84px_1fr] items-center gap-4">
      <div className="text-sm font-medium text-gray-700 dark:text-[#d7d8dd]">{title}</div>
      <div className="flex flex-wrap gap-4">{children}</div>
    </div>
  );
}

function CheckPill({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-[#d7d8dd]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 accent-pink-500"
        aria-label={label}
      />
      {label.replace("输入", "").replace("输出", "")}
    </label>
  );
}

function TokenInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex">
      <input
        id={id}
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 min-w-0 flex-1 rounded-l border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-pink-400 dark:border-[#34363c] dark:bg-[#1f2024]"
      />
      <span className="inline-flex h-9 items-center rounded-r border border-l-0 border-gray-200 bg-gray-50 px-3 text-xs text-gray-500 dark:border-[#34363c] dark:bg-[#2a2c30]">
        Tokens
      </span>
    </div>
  );
}

function buildModelConfig(form: AddModelFormState): Record<string, unknown> {
  const customConfig = parseJsonObject(form.customJson);
  const config: Record<string, unknown> = {
    ...customConfig,
    inputCapabilities: [
      ...(form.inputText ? ["text"] : []),
      ...(form.inputImage ? ["image"] : []),
    ],
    outputCapabilities: [
      ...(form.outputText ? ["text"] : []),
      ...(form.outputImage ? ["image"] : []),
    ],
    features: [
      ...(form.toolCalling ? ["tools"] : []),
      ...(form.thinking ? ["thinking"] : []),
    ],
  };

  setOptionalNumber(config, "contextWindow", form.contextWindow);
  setOptionalNumber(config, "maxOutputTokens", form.maxOutputTokens);
  setOptionalNumber(config, "temperature", form.temperature);
  setOptionalNumber(config, "topP", form.topP);
  setOptionalNumber(config, "frequencyPenalty", form.frequencyPenalty);

  return config;
}

function parseJsonObject(value: string): Record<string, unknown> {
  const trimmed = value.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("自定义参数必须是 JSON 对象");
  }
  return parsed as Record<string, unknown>;
}

function setOptionalNumber(config: Record<string, unknown>, key: string, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return;
  const numericValue = Number(trimmed);
  if (!Number.isFinite(numericValue)) {
    throw new Error(`${key} 必须是数字`);
  }
  config[key] = numericValue;
}

function ModelTable({
  models,
  busy,
  onFavorite,
  onToggleActive,
  onDelete,
}: {
  models: Model[];
  busy: boolean;
  onFavorite: (model: Model) => void;
  onToggleActive: (model: Model) => void;
  onDelete: (model: Model) => void;
}) {
  if (models.length === 0) {
    return <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">暂无模型</div>;
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-gray-100 text-left text-xs text-gray-500 dark:border-[#34363c]">
          <th className="py-2 font-medium">模型</th>
          <th className="py-2 font-medium">类型</th>
          <th className="py-2 font-medium">状态</th>
          <th className="py-2 text-right font-medium">操作</th>
        </tr>
      </thead>
      <tbody>
        {models.map((model) => (
          <tr key={model.id} className="border-b border-gray-100 dark:border-[#34363c]">
            <td className="py-3 font-medium text-gray-800 dark:text-[#e8e9ed]">{model.modelName}</td>
            <td className="py-3 text-gray-500">{model.modelType}</td>
            <td className="py-3">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs",
                  model.isActive === false
                    ? "bg-gray-100 text-gray-500 dark:bg-[#34363c]"
                    : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
                )}
              >
                {model.isActive === false ? "已禁用" : "已启用"}
              </span>
            </td>
            <td className="py-3">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onFavorite(model)}
                  disabled={busy}
                  className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-[#34363c] dark:text-[#e8e9ed]"
                >
                  {model.isFavorite ? "取消收藏" : "收藏"}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleActive(model)}
                  disabled={busy}
                  className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-[#34363c] dark:text-[#e8e9ed]"
                >
                  {model.isActive === false ? "启用" : "禁用"}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(model)}
                  disabled={busy}
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-60"
                >
                  删除
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ProviderSettingsDialog({
  provider,
  api,
  onClose,
  onChanged,
  onDeleted,
}: {
  provider: DisplayProvider | null;
  api: ModelsPageApi;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [form, setForm] = useState<CustomProviderForm>(initialCustomProviderForm);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);

  useEffect(() => {
    if (provider) {
      setForm({
        name: provider.name,
        protocol: provider.protocol || "openai",
        apiUrl: provider.apiUrl || provider.apiBase || "",
        apiKey: provider.apiKey || (hasStoredApiKey(provider) ? maskedApiKey : ""),
        headers: stringifyHeaders(provider.attributes),
      });
      setStatus(null);
      setTesting(false);
      setSaving(false);
      setApiKeyVisible(false);
    }
  }, [provider]);

  if (!provider) return null;

  const payload = () => {
    const headers = parseHeaderLines(form.headers);
    const apiKey = form.apiKey.trim();
    return {
      name: form.name.trim(),
      protocol: form.protocol,
      apiUrl: form.apiUrl.trim(),
      ...(apiKey && apiKey !== maskedApiKey ? { apiKey } : {}),
      ...(headers ? { attributes: { headers } } : {}),
    };
  };

  const handleTest = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const data = payload();
      const result = await api.client.testProviderConnection({
        provider: provider.provider,
        protocol: data.protocol,
        apiUrl: data.apiUrl,
        apiKey: "apiKey" in data ? (data.apiKey ?? "") : "",
        ...(data.attributes ? { attributes: data.attributes } : {}),
      });
      setStatus({
        type: result.success ? "success" : "error",
        message: result.message || (result.success ? "连接成功" : "连接失败"),
      });
    } catch (testError) {
      setStatus({
        type: "error",
        message: testError instanceof Error ? testError.message : "连接测试失败",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await api.client.updateProvider(provider.id, payload());
      setStatus({ type: "success", message: "供应商设置已保存" });
      onChanged();
    } catch (saveError) {
      setStatus({
        type: "error",
        message: saveError instanceof Error ? saveError.message : "供应商保存失败",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await api.client.deleteProvider(provider.id);
      onDeleted();
    } catch (deleteError) {
      setStatus({
        type: "error",
        message: deleteError instanceof Error ? deleteError.message : "供应商删除失败",
      });
      setSaving(false);
    }
  };

  const canToggleApiKeyVisibility = Boolean(form.apiKey && form.apiKey !== maskedApiKey);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overscroll-contain bg-white/70 px-4 backdrop-blur-[1px] dark:bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${provider.name} 供应商设置`}
        className="w-full max-w-[560px] rounded-xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-[#2f3137] dark:bg-[#232428]"
      >
        <DialogHeader title={`${provider.name} 供应商设置`} onClose={onClose} />

        <div className="space-y-4">
          <LabeledField label="名字" htmlFor="provider-settings-name">
            <input
              id="provider-settings-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="h-10 w-full rounded border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-pink-400 dark:border-[#34363c] dark:bg-[#1f2024]"
            />
          </LabeledField>

          <LabeledField label="协议类型" htmlFor="provider-settings-protocol">
            <ProtocolSelect
              id="provider-settings-protocol"
              value={form.protocol}
              onChange={(protocol) => setForm((current) => ({ ...current, protocol }))}
            />
          </LabeledField>

          <LabeledField label="API地址" htmlFor="provider-settings-api-url">
            <input
              id="provider-settings-api-url"
              value={form.apiUrl}
              onChange={(event) => setForm((current) => ({ ...current, apiUrl: event.target.value }))}
              className="h-10 w-full rounded border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-pink-400 dark:border-[#34363c] dark:bg-[#1f2024]"
            />
          </LabeledField>

          <LabeledField label="API KEY" htmlFor="provider-settings-api-key">
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  id="provider-settings-api-key"
                  type={apiKeyVisible ? "text" : "password"}
                  value={form.apiKey}
                  onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
                  placeholder="api_key"
                  className="h-10 w-full rounded border border-gray-200 bg-white px-3 pr-9 text-sm outline-none transition focus:border-pink-400 dark:border-[#34363c] dark:bg-[#1f2024]"
                />
                {canToggleApiKeyVisibility ? (
                  <button
                    type="button"
                    aria-label={apiKeyVisible ? "隐藏 API KEY" : "显示 API KEY"}
                    onClick={() => setApiKeyVisible((visible) => !visible)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-[#e8e9ed]"
                  >
                    {apiKeyVisible ? (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || saving}
                className="h-10 rounded bg-pink-500 px-5 text-sm font-medium text-white shadow-sm hover:bg-pink-500/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {testing ? "测试中..." : "测试"}
              </button>
            </div>
          </LabeledField>

          <LabeledField label="自定义请求头" htmlFor="provider-settings-headers" alignStart>
            <textarea
              id="provider-settings-headers"
              value={form.headers}
              onChange={(event) => setForm((current) => ({ ...current, headers: event.target.value }))}
              placeholder="每行一个请求头，格式为: Key: Value"
              rows={4}
              className="min-h-[112px] w-full resize-y rounded border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-pink-400 dark:border-[#34363c] dark:bg-[#1f2024]"
            />
          </LabeledField>
        </div>

        <DialogStatus status={status} />

        <div className="mt-6 flex justify-between gap-3">
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving || testing}
            className="h-9 rounded border border-red-200 bg-white px-4 text-sm font-medium text-red-500 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            删除供应商
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || testing}
              className="h-9 rounded border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#34363c] dark:bg-[#2a2c30] dark:text-[#e8e9ed]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || testing}
              className="h-9 rounded bg-pink-500 px-4 text-sm font-medium text-white shadow-sm hover:bg-pink-500/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DialogHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-[#e8e9ed]">{title}</h2>
      <button
        type="button"
        aria-label="关闭"
        onClick={onClose}
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-[#2a2c30] dark:hover:text-[#e8e9ed]"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function DialogStatus({ status }: { status: { type: "success" | "error"; message: string } | null }) {
  if (!status) return null;
  return (
    <div
      className={cn(
        "mt-4 rounded px-3 py-2 text-sm",
        status.type === "success"
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300",
      )}
    >
      {status.message}
    </div>
  );
}

function LabeledField({
  label,
  htmlFor,
  alignStart = false,
  children,
}: {
  label: string;
  htmlFor: string;
  alignStart?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid grid-cols-[84px_1fr] gap-4", alignStart ? "items-start" : "items-center")}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-gray-700 dark:text-[#d7d8dd]">
        {label}
      </label>
      <div>{children}</div>
    </div>
  );
}

function ProtocolSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = protocolOptions.find((option) => option.value === value) ?? protocolOptions[0];

  return (
    <div className="relative">
      <button
        id={id}
        type="button"
        aria-label="协议类型"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 text-left text-sm outline-none transition hover:border-gray-300 focus:border-pink-400 dark:border-[#34363c] dark:bg-[#1f2024]",
        )}
      >
        <span>{selected.label}</span>
        <ChevronDown
          className={cn("h-4 w-4 text-gray-400 transition-transform", open ? "rotate-180" : "")}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="协议类型"
          className="absolute left-0 right-0 top-[calc(100%+10px)] z-70 overflow-hidden rounded-xl border border-gray-100 bg-white p-2 text-sm shadow-xl dark:border-[#3a3c42] dark:bg-[#25272c]"
        >
          {protocolOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left transition-colors",
                option.value === value
                  ? "bg-pink-50 text-pink-500 dark:bg-pink-500/10 dark:text-pink-300"
                  : "text-gray-700 hover:bg-gray-50 dark:text-[#d7d8dd] dark:hover:bg-[#30323a]",
              )}
            >
              <span>{option.label}</span>
              <span className="text-pink-500" aria-hidden="true">
                {option.value === value ? "✓" : ""}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function parseHeaderLines(value: string): Record<string, string> | undefined {
  const headers = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex <= 0) {
        throw new Error("请求头格式应为 Key: Value");
      }

      const key = line.slice(0, separatorIndex).trim();
      const headerValue = line.slice(separatorIndex + 1).trim();
      if (!key || !headerValue) {
        throw new Error("请求头格式应为 Key: Value");
      }

      acc[key] = headerValue;
      return acc;
    }, {});

  return Object.keys(headers).length > 0 ? headers : undefined;
}

function stringifyHeaders(attributes: unknown): string {
  if (!attributes || typeof attributes !== "object") return "";
  const headers = (attributes as { headers?: unknown }).headers;
  if (!headers || typeof headers !== "object") return "";

  return Object.entries(headers as Record<string, unknown>)
    .filter(([, value]) => typeof value === "string" && value.length > 0)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof document === "undefined") return;

    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverscrollBehavior = document.body.style.overscrollBehavior;
    const htmlOverscrollBehavior = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "contain";
    document.documentElement.style.overscrollBehavior = "contain";

    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overscrollBehavior = bodyOverscrollBehavior;
      document.documentElement.style.overscrollBehavior = htmlOverscrollBehavior;
    };
  }, [locked]);
}

function DeleteProviderDialog({
  provider,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  provider: DisplayProvider | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!provider) return null;

  return (
    <div className="fixed inset-0 z-70 grid place-items-center overscroll-contain bg-white/75 px-4 backdrop-blur-[1px] dark:bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="删除供应商"
        className="w-full max-w-[360px] rounded-xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-[#2f3137] dark:bg-[#232428]"
      >
        <h2 className="text-base font-semibold text-gray-900 dark:text-[#e8e9ed]">删除供应商</h2>
        <div className="mt-4 flex gap-3 text-sm text-gray-700 dark:text-[#d7d8dd]">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-600">
            !
          </span>
          <p>
            确定要删除供应商“{provider.name}”吗？这将同时删除该供应商下的所有模型，操作不可恢复。
          </p>
        </div>
        {error ? <div className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-8 rounded border border-gray-200 bg-white px-4 text-sm text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#34363c] dark:bg-[#2a2c30] dark:text-[#e8e9ed]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="h-8 rounded bg-pink-500 px-4 text-sm font-medium text-white shadow-sm hover:bg-pink-500/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "删除中..." : "确认"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ProviderSectionProps {
  title: string;
  providers: DisplayProvider[];
  variant: "added" | "template";
  onManageModels?: (provider: DisplayProvider) => void;
  onEditSettings?: (provider: DisplayProvider) => void;
  onDeleteProvider?: (provider: DisplayProvider) => void;
  onAddProvider?: (provider: DisplayProvider) => void;
  addingProviderId?: string | null;
}

function ProviderSection({
  title,
  providers,
  variant,
  onManageModels,
  onEditSettings,
  onDeleteProvider,
  onAddProvider,
  addingProviderId,
}: ProviderSectionProps) {
  return (
    <section aria-label={title} className="mb-8">
      <h3 className="mb-3 text-sm font-medium text-gray-500 dark:text-[#8b8d95]">{title}</h3>
      {providers.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              variant={variant}
              onManageModels={onManageModels}
              onEditSettings={onEditSettings}
              onDeleteProvider={onDeleteProvider}
              onAddProvider={onAddProvider}
              adding={addingProviderId === provider.id}
            />
          ))}
        </div>
      ) : (
        <div className="col-span-full py-8 text-center text-sm text-gray-400 dark:text-[#6b6d75]">
          暂无数据
        </div>
      )}
    </section>
  );
}

function ProviderCard({
  provider,
  variant,
  onManageModels,
  onEditSettings,
  onDeleteProvider,
  onAddProvider,
  adding = false,
}: {
  provider: DisplayProvider;
  variant: "added" | "template";
  onManageModels?: (provider: DisplayProvider) => void;
  onEditSettings?: (provider: DisplayProvider) => void;
  onDeleteProvider?: (provider: DisplayProvider) => void;
  onAddProvider?: (provider: DisplayProvider) => void;
  adding?: boolean;
}) {
  return (
    <article
      aria-label={provider.name}
      className="group relative min-h-[140px] w-full cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white p-4 text-left transition-all duration-200 hover:border-pink-500 dark:border-[#232428] dark:bg-[#232428]"
    >
      <span className="flex items-start gap-3">
        <ProviderAvatar provider={provider} />
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span
              className={cn(
                "truncate text-base font-medium",
                variant === "added" ? "text-gray-900 dark:text-[#e8e9ed]" : "text-gray-700 dark:text-[#e8e9ed]",
              )}
              title={provider.name}
            >
              {provider.name}
            </span>
            {variant === "added" ? (
              <button
                type="button"
                aria-label={`删除供应商 ${provider.name}`}
                onClick={() => onDeleteProvider?.(provider)}
                className="rounded border border-red-200 bg-white p-1 text-red-500 opacity-0 transition-opacity duration-200 hover:bg-red-50 group-hover:opacity-100 dark:border-red-500/30 dark:bg-[#232428]"
              >
                <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            ) : null}
          </span>
          <span className="mt-1.5 block text-xs text-gray-500 dark:text-[#8b8d95]">
            {getProtocolLabel(provider.protocol)}
          </span>
        </span>
      </span>
      <span className="mt-2 line-clamp-2 block text-xs leading-relaxed text-gray-400 dark:text-[#6b6d75]">
        {provider.description || (variant === "template" ? "点击添加到您的分组" : "暂无简介")}
      </span>

      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-16 rounded-b-lg bg-linear-to-t from-white via-white/90 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:from-[#232428] dark:via-[#232428]/90" />
      <span className="pointer-events-auto absolute inset-x-2 bottom-2 flex gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {variant === "added" ? (
          <>
            <button
              type="button"
              onClick={() => onManageModels?.(provider)}
              className="flex-1 rounded bg-pink-500 px-3 py-1.5 text-center text-sm font-medium text-white shadow-sm"
            >
              模型管理
            </button>
            <button
              type="button"
              onClick={() => onEditSettings?.(provider)}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-gray-200 bg-white px-3 py-1.5 text-center text-sm font-medium text-gray-700 shadow-sm dark:border-[#2e3035] dark:bg-[#2a2c30] dark:text-[#e8e9ed]"
            >
              <Settings className="h-3.5 w-3.5" aria-hidden="true" />
              供应商设置
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onAddProvider?.(provider)}
            disabled={adding}
            className="w-full rounded bg-pink-500 px-3 py-1.5 text-center text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {adding ? "添加中..." : "添加此供应商"}
          </button>
        )}
      </span>
    </article>
  );
}

function ProviderAvatar({ provider }: { provider: DisplayProvider }) {
  const initial = provider.name.trim().charAt(0).toUpperCase() || "M";
  const iconSrc = getProviderIcon(provider);

  if (iconSrc) {
    return (
      <img
        src={iconSrc}
        alt=""
        className="h-11 w-11 shrink-0 rounded object-contain"
        aria-hidden="true"
      />
    );
  }

  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded bg-slate-100 text-lg font-bold text-slate-700 dark:bg-[#2a2c30] dark:text-[#e8e9ed]">
      {initial}
    </span>
  );
}

function providerTemplate(
  id: string,
  name: string,
  protocol: string,
  description: string,
  avatarUrl?: string,
): DisplayProvider {
  return {
    id,
    name,
    provider: id,
    protocol,
    description,
    avatarUrl,
    apiKeySet: false,
    isActive: false,
  };
}

function hasStoredApiKey(provider: DisplayProvider) {
  return provider.apiKeySet === true || Boolean(provider.apiKey);
}

function isAddedProvider(provider: ModelProvider) {
  return provider.apiKeySet || provider.isActive || (provider.models?.length ?? 0) > 0;
}

function getProviderIcon(provider: DisplayProvider) {
  const avatarUrl = provider.avatarUrl;
  if (avatarUrl?.startsWith("/")) return avatarUrl;
  if (avatarUrl?.startsWith("http://") || avatarUrl?.startsWith("https://")) return avatarUrl;
  if (avatarUrl) return `/images/providers/${avatarUrl}`;

  const providerId = provider.provider ?? provider.id;
  if (providerId && providerId !== "custom") {
    return `/images/providers/${providerId}.svg`;
  }
  return null;
}

function getProtocolLabel(protocol?: string) {
  const protocolMap: Record<string, string> = {
    openai: "OpenAI",
    "openai-response": "OpenAI-Response",
    gemini: "Gemini",
    anthropic: "Anthropic",
  };
  return protocol ? protocolMap[protocol] ?? protocol : "未知协议";
}

function mergeProviderTemplateMetadata(provider: ModelProvider): DisplayProvider {
  const template = providerTemplates.find((item) => item.id === provider.provider);
  if (!template) return provider;
  const providerDescription =
    "description" in provider && typeof provider.description === "string"
      ? provider.description
      : undefined;

  return {
    ...provider,
    name: provider.name || template.name,
    protocol: provider.protocol || template.protocol,
    avatarUrl: provider.avatarUrl || template.avatarUrl,
    description: providerDescription || template.description,
  };
}

export default ModelsPage;
