import { useEffect, useMemo, useRef, useState } from "react";
import type { SettingsPageApi } from ".";
import { SettingsRow, SettingsSection, SettingsSwitch, SettingsTextInput, SettingsToast } from "./settings-components";

interface GeneralSettingsPanelProps {
  api: SettingsPageApi;
}

interface SystemSettings {
  autoLoginEnabled: boolean;
  workspaceBaseDir: string;
}

export function GeneralSettingsPanel({ api }: GeneralSettingsPanelProps) {
  const [settings, setSettings] = useState<SystemSettings>({
    autoLoginEnabled: false,
    workspaceBaseDir: "",
  });
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const originalRef = useRef<SystemSettings | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      const response = await api.client.fetchGroupSettings("system");
      if (cancelled) return;
      const nextSettings = {
        autoLoginEnabled: response.autoLoginEnabled === true || response.autoLoginEnabled === "true",
        workspaceBaseDir: typeof response.workspaceBaseDir === "string" ? response.workspaceBaseDir : "",
      };
      setSettings(nextSettings);
      originalRef.current = nextSettings;
      setLoaded(true);
    }

    void loadSettings().catch(() => {
      if (!cancelled) {
        originalRef.current = settings;
        setLoaded(true);
        setMessage("获取通用设置失败");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [api]);

  const hasChanges = useMemo(() => {
    return loaded && JSON.stringify(settings) !== JSON.stringify(originalRef.current);
  }, [loaded, settings]);

  useEffect(() => {
    if (!hasChanges) return;

    const timer = window.setTimeout(() => {
      void saveSettings();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [hasChanges, settings]);

  async function saveSettings() {
    const workspaceBaseDir = settings.workspaceBaseDir.trim();
    if (workspaceBaseDir && !isAbsolutePath(workspaceBaseDir)) {
      setMessage("工作目录基路径必须是绝对路径");
      return;
    }

    try {
      await api.client.updateGroupSettings("system", {
        autoLoginEnabled: settings.autoLoginEnabled,
        workspaceBaseDir: workspaceBaseDir || null,
      });
      originalRef.current = settings;
      setMessage("保存成功");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存通用设置失败");
    }
  }

  return (
    <div className="space-y-8">
      <SettingsSection title="登录">
        <SettingsRow
          title="免登录模式"
          description="开启后，刷新页面或访问应用时会自动使用主账户登录。开启此功能后，任何访问此应用的人都将自动获得主账户权限，请谨慎使用。"
          bordered={false}
        >
          <SettingsSwitch
            label="免登录模式"
            checked={settings.autoLoginEnabled}
            onChange={(checked) => setSettings((current) => ({ ...current, autoLoginEnabled: checked }))}
          />
        </SettingsRow>
      </SettingsSection>
      <SettingsSection title="工作目录">
        <SettingsRow
          title="工作目录基路径"
          description="所有新会话的默认工作目录将创建在此路径下。必须使用绝对路径，修改后仅影响新创建的会话目录。"
          bordered={false}
        >
          <div className="flex w-full max-w-xl gap-2">
            <SettingsTextInput
              aria-label="工作目录基路径"
              value={settings.workspaceBaseDir}
              placeholder="例如：D:\\AI_Workspaces（留空使用系统默认）"
              onChange={(event) =>
                setSettings((current) => ({ ...current, workspaceBaseDir: event.target.value }))
              }
            />
            <button
              type="button"
              className="h-9 shrink-0 whitespace-nowrap rounded-md border border-pink-100 bg-pink-50 px-3 text-sm font-medium text-pink-500 hover:border-pink-200 hover:bg-pink-100 dark:border-[#34363c] dark:bg-[#2a2c30]"
              onClick={() => setMessage("当前环境不支持文件夹选择，请直接输入路径")}
            >
              选择文件夹
            </button>
          </div>
        </SettingsRow>
      </SettingsSection>
      {message ? <SettingsToast message={message} onClose={() => setMessage(null)} /> : null}
    </div>
  );
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith("/") || /^[a-zA-Z]:\\/.test(path);
}
