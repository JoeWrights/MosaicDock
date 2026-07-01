import { useEffect, useMemo, useState } from "react";
import type { Model, ModelProvider } from "@mosaic-dock/shared";
import type { SettingsPageApi } from ".";
import { ModelCapabilityIcons } from "../../components/models/ModelCapabilityIcons";
import { SettingsRow, SettingsSection, SettingsToast } from "./settings-components";

interface DefaultModelSettingsPanelProps {
  api: SettingsPageApi;
}

type ModelSettingKey =
  | "defaultChatModelId"
  | "defaultTitleSummaryModelId"
  | "defaultVisualAssistantModelId"
  | "defaultHistoryCompressionModelId";

interface ModelSettings {
  defaultChatModelId: string | null;
  defaultTitleSummaryModelId: string | null;
  defaultVisualAssistantModelId: string | null;
  defaultHistoryCompressionModelId: string | null;
}

const emptyModelSettings: ModelSettings = {
  defaultChatModelId: null,
  defaultTitleSummaryModelId: null,
  defaultVisualAssistantModelId: null,
  defaultHistoryCompressionModelId: null,
};

const modelRows: Array<{ key: ModelSettingKey; title: string; description: string }> = [
  { key: "defaultChatModelId", title: "默认对话模型", description: "用于日常对话生成的默认 AI 模型" },
  { key: "defaultTitleSummaryModelId", title: "标题总结模型", description: "用于自动生成会话标题的 AI 模型" },
  {
    key: "defaultVisualAssistantModelId",
    title: "视觉辅助模型",
    description: "用于图片识别等视觉任务的 AI 模型（需支持图像输入）",
  },
  {
    key: "defaultHistoryCompressionModelId",
    title: "历史压缩模型",
    description: "用于压缩对话历史以优化上下文长度的 AI 模型",
  },
];

export function DefaultModelSettingsPanel({ api }: DefaultModelSettingsPanelProps) {
  const [settings, setSettings] = useState<ModelSettings>(emptyModelSettings);
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [dialogKey, setDialogKey] = useState<ModelSettingKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const models = useMemo(() => providers.flatMap((provider) => provider.models ?? []), [providers]);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      const [settingsResponse, modelResponse] = await Promise.all([
        api.client.fetchGroupSettings("models"),
        api.client.fetchAllModels(),
      ]);
      if (cancelled) return;
      setSettings({
        defaultChatModelId: getNullableString(settingsResponse.defaultChatModelId),
        defaultTitleSummaryModelId: getNullableString(settingsResponse.defaultTitleSummaryModelId),
        defaultVisualAssistantModelId: getNullableString(settingsResponse.defaultVisualAssistantModelId),
        defaultHistoryCompressionModelId: getNullableString(settingsResponse.defaultHistoryCompressionModelId),
      });
      setProviders(modelResponse.items);
    }

    void loadSettings().catch((error) => {
      setMessage(error instanceof Error ? error.message : "获取默认模型设置失败");
    });

    return () => {
      cancelled = true;
    };
  }, [api]);

  async function selectModel(modelId: string) {
    if (!dialogKey) return;
    const previousSettings = settings;
    const nextSettings = { ...settings, [dialogKey]: modelId };
    setSettings(nextSettings);
    setDialogKey(null);
    try {
      await api.client.updateGroupSettings("models", nextSettings);
      setMessage("保存成功");
    } catch (error) {
      setSettings(previousSettings);
      setMessage(error instanceof Error ? error.message : "保存默认模型设置失败");
    }
  }

  return (
    <div className="space-y-8">
      <SettingsSection title="对话">
        {modelRows.slice(0, 2).map((row, index) => (
          <SettingsRow
            key={row.key}
            title={row.title}
            description={row.description}
            bordered={index === 0}
          >
            <ModelSelectButton
              title={row.title}
              model={models.find((model) => model.id === settings[row.key]) ?? null}
              onClick={() => setDialogKey(row.key)}
            />
          </SettingsRow>
        ))}
      </SettingsSection>
      <SettingsSection title="视觉">
        <SettingsRow title={modelRows[2].title} description={modelRows[2].description} bordered={false}>
          <ModelSelectButton
            title={modelRows[2].title}
            model={models.find((model) => model.id === settings.defaultVisualAssistantModelId) ?? null}
            onClick={() => setDialogKey("defaultVisualAssistantModelId")}
          />
        </SettingsRow>
      </SettingsSection>
      <SettingsSection title="压缩">
        <SettingsRow title={modelRows[3].title} description={modelRows[3].description} bordered={false}>
          <ModelSelectButton
            title={modelRows[3].title}
            model={models.find((model) => model.id === settings.defaultHistoryCompressionModelId) ?? null}
            onClick={() => setDialogKey("defaultHistoryCompressionModelId")}
          />
        </SettingsRow>
      </SettingsSection>
      {dialogKey ? (
        <div className="fixed inset-0 z-70 grid place-items-center bg-black/30 px-4">
          <div
            role="dialog"
            aria-label="选择模型"
            className="w-full max-w-[600px] rounded-xl bg-white p-5 shadow-[0_12px_32px_rgba(0,0,0,0.15),0_4px_8px_rgba(0,0,0,0.1)] ring-1 ring-gray-200 dark:bg-[#232428] dark:ring-[#34363c]"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">选择模型</h2>
              <button type="button" className="text-sm text-muted-foreground" onClick={() => setDialogKey(null)}>
                关闭
              </button>
            </div>
            <div className="max-h-[60vh] space-y-4 overflow-y-auto">
              {providers.map((provider) => (
                <div key={provider.id}>
                  <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">{provider.name}</div>
                  <div className="space-y-2">
                    {(provider.models ?? []).map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        className="w-full rounded-lg border border-gray-100 p-3 text-left transition-colors hover:bg-pink-50 dark:border-[#34363c] dark:hover:bg-pink-900/10"
                        onClick={() => void selectModel(model.id)}
                      >
                        <div className="font-medium text-slate-800 dark:text-[#e8e9ed]">{model.modelName}</div>
                        <ModelCapabilityIcons model={model} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {message ? <SettingsToast message={message} onClose={() => setMessage(null)} /> : null}
    </div>
  );
}

function ModelSelectButton({
  title,
  model,
  onClick,
}: {
  title: string;
  model: Model | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${title} ${model?.modelName ?? "请选择模型"}`}
      className="flex h-9 w-72 items-center justify-between rounded-md border border-gray-200 bg-white px-3 text-left text-sm text-slate-700 hover:border-pink-200 dark:border-[#34363c] dark:bg-[#1e1f23] dark:text-[#e8e9ed]"
      onClick={onClick}
    >
      <span className="truncate">{model?.modelName ?? "请选择模型"}</span>
      <span className="text-xs text-slate-400">选择</span>
    </button>
  );
}

function getNullableString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}
