import { useEffect, useMemo, useRef, useState } from "react";
import type { SettingsPageApi } from ".";
import { SettingsRow, SettingsSection, SettingsSelect, SettingsTextInput, SettingsToast } from "./settings-components";

interface OcrSettingsPanelProps {
  api: SettingsPageApi;
}

interface OcrSettings {
  provider: "none" | "umi";
  umiHost: string;
  umiPort: number;
}

export function OcrSettingsPanel({ api }: OcrSettingsPanelProps) {
  const [settings, setSettings] = useState<OcrSettings>({
    provider: "none",
    umiHost: "127.0.0.1",
    umiPort: 1224,
  });
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const originalRef = useRef<OcrSettings | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      const response = await api.client.fetchGroupSettings("ocr");
      if (cancelled) return;
      const nextSettings = {
        provider: response.provider === "umi" ? "umi" : "none",
        umiHost: typeof response.umiHost === "string" ? response.umiHost : "127.0.0.1",
        umiPort: typeof response.umiPort === "number" ? response.umiPort : 1224,
      } satisfies OcrSettings;
      setSettings(nextSettings);
      originalRef.current = nextSettings;
      setLoaded(true);
    }

    void loadSettings().catch(() => {
      if (!cancelled) {
        originalRef.current = settings;
        setLoaded(true);
        setMessage("获取 OCR 设置失败");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [api]);

  const hasChanges = useMemo(
    () => loaded && JSON.stringify(settings) !== JSON.stringify(originalRef.current),
    [loaded, settings],
  );

  useEffect(() => {
    if (!hasChanges) return;

    const timer = window.setTimeout(() => {
      void saveSettings();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [hasChanges, settings]);

  async function saveSettings() {
    const data =
      settings.provider === "umi"
        ? { provider: settings.provider, umiHost: settings.umiHost || "127.0.0.1", umiPort: settings.umiPort || 1224 }
        : { provider: settings.provider };
    try {
      await api.client.updateGroupSettings("ocr", data);
      originalRef.current = settings;
      setMessage("保存成功");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存 OCR 设置失败");
    }
  }

  return (
    <div className="space-y-8">
      <SettingsSection title="OCR 服务">
        <SettingsRow
          title="OCR 提供商"
          description="选择用于识别扫描件 PDF 的 OCR 服务，查看使用说明"
          bordered={settings.provider === "none"}
        >
          <SettingsSelect
            label="OCR 提供商"
            value={settings.provider}
            onChange={(value) => setSettings((current) => ({ ...current, provider: value === "umi" ? "umi" : "none" }))}
            options={[
              { value: "none", label: "不启用 OCR" },
              { value: "umi", label: "UMI-OCR（本地）" },
            ]}
            className="w-[200px]"
          />
        </SettingsRow>
        {settings.provider === "umi" ? (
          <>
            <SettingsRow title="服务地址" description="UMI-OCR 服务的主机地址">
              <SettingsTextInput
                aria-label="服务地址"
                value={settings.umiHost}
                onChange={(event) => setSettings((current) => ({ ...current, umiHost: event.target.value }))}
                className="w-[200px]"
                placeholder="127.0.0.1"
              />
            </SettingsRow>
            <SettingsRow title="服务端口" description="UMI-OCR 服务的端口号" bordered={false}>
              <SettingsTextInput
                aria-label="服务端口"
                type="number"
                min={1}
                max={65535}
                value={settings.umiPort}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, umiPort: Number(event.target.value) || 1224 }))
                }
                className="w-[200px]"
              />
            </SettingsRow>
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-3.5 text-xs text-gray-500 dark:border-[#2e3035] dark:bg-[#1e1f23] dark:text-[#8b8d95]">
              <div>• 请确保 UMI-OCR 服务已启动（Umi-OCR.exe --server）</div>
              <div>• 默认监听地址：http://127.0.0.1:1224</div>
              <div>• 支持 PDF 和图片的 OCR 识别</div>
            </div>
          </>
        ) : (
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3.5 text-xs text-gray-500 dark:border-[#2e3035] dark:bg-[#1e1f23] dark:text-[#8b8d95]">
            • 不启用 OCR 时，扫描件 PDF 将无法被识别和索引
          </div>
        )}
      </SettingsSection>
      {message ? <SettingsToast message={message} onClose={() => setMessage(null)} /> : null}
    </div>
  );
}
