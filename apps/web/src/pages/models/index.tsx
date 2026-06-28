import { useEffect, useMemo, useState } from "react";
import { Plus, Settings, Trash2 } from "lucide-react";
import { mosaicApi, type ApiClient } from "@mosaic-dock/api-client";
import type { ModelProvider } from "@mosaic-dock/shared";
import { WorkspacePageHeader } from "../../components/layout/WorkspacePageHeader";
import { EmptyState } from "../../components/ui/empty-state";
import { Spinner } from "../../components/ui/spinner";
import { cn } from "../../lib/utils";

export interface ModelsPageApi {
  client: Pick<ApiClient, "fetchAllModels">;
}

interface ModelsPageProps {
  api?: ModelsPageApi;
}

type DisplayProvider = ModelProvider & {
  description?: string;
};

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
];

export function ModelsPage({ api = mosaicApi }: ModelsPageProps) {
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const { addedProviders, availableProviders } = useMemo(() => {
    const addedProviders = providers.filter(isAddedProvider).map(mergeProviderTemplateMetadata);
    const addedProviderTypes = new Set(addedProviders.map((provider) => provider.provider ?? provider.id));
    const availableProviders = providerTemplates.filter((template) => !addedProviderTypes.has(template.id));

    return { addedProviders, availableProviders };
  }, [providers]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground dark:bg-[#1e1f23] dark:text-[#e8e9ed]">
      <div className="px-4 sm:px-6">
        <WorkspacePageHeader
          title="模型管理"
          actions={
            <button
              type="button"
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
              <ProviderSection title="已添加的供应商" providers={addedProviders} variant="added" />
              <ProviderSection title="可添加的供应商" providers={availableProviders} variant="template" />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

interface ProviderSectionProps {
  title: string;
  providers: DisplayProvider[];
  variant: "added" | "template";
}

function ProviderSection({ title, providers, variant }: ProviderSectionProps) {
  return (
    <section aria-label={title} className="mb-8">
      <h3 className="mb-3 text-sm font-medium text-gray-500 dark:text-[#8b8d95]">{title}</h3>
      {providers.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} variant={variant} />
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

function ProviderCard({ provider, variant }: { provider: DisplayProvider; variant: "added" | "template" }) {
  return (
    <button
      type="button"
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
              <span className="rounded p-0.5 text-red-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
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
            <span className="flex-1 rounded bg-pink-500 px-3 py-1.5 text-center text-sm font-medium text-white shadow-sm">
              模型管理
            </span>
            <span className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-gray-200 bg-white px-3 py-1.5 text-center text-sm font-medium text-gray-700 shadow-sm dark:border-[#2e3035] dark:bg-[#2a2c30] dark:text-[#e8e9ed]">
              <Settings className="h-3.5 w-3.5" aria-hidden="true" />
              供应商设置
            </span>
          </>
        ) : (
          <span className="w-full rounded bg-pink-500 px-3 py-1.5 text-center text-sm font-medium text-white shadow-sm">
            添加此供应商
          </span>
        )}
      </span>
    </button>
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
