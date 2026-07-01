import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { SettingsPageApi } from ".";
import {
  SettingsRow,
  SettingsSection,
  SettingsSlider,
  SettingsSwitch,
  SettingsToast,
} from "./settings-components";

interface AppearanceSettingsPanelProps {
  api: SettingsPageApi;
}

interface AppearanceSettings {
  wallpaperUrl: string | null;
  sidebarOpacity: number;
  contentOpacity: number;
  acrylicEnabled: boolean;
  blurRadius: number;
}

const defaultAppearanceSettings: AppearanceSettings = {
  wallpaperUrl: null,
  sidebarOpacity: 100,
  contentOpacity: 100,
  acrylicEnabled: true,
  blurRadius: 20,
};

export function AppearanceSettingsPanel({ api }: AppearanceSettingsPanelProps) {
  const [settings, setSettings] = useState<AppearanceSettings>(defaultAppearanceSettings);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      const response = await api.client.fetchGroupSettings("appearance");
      if (cancelled) return;
      setSettings({
        wallpaperUrl: getNullableString(response.wallpaperUrl),
        sidebarOpacity: getNumber(response.sidebarOpacity, 100),
        contentOpacity: getNumber(response.contentOpacity, 100),
        acrylicEnabled: response.acrylicEnabled !== false,
        blurRadius: getNumber(response.blurRadius, 20),
      });
    }

    void loadSettings().catch((error) => {
      setMessage(error instanceof Error ? error.message : "获取外观设置失败");
    });

    return () => {
      cancelled = true;
    };
  }, [api]);

  async function saveSettings(nextSettings: AppearanceSettings) {
    const previousSettings = settings;
    setSettings(nextSettings);
    try {
      await api.client.updateGroupSettings("appearance", { ...nextSettings });
      return true;
    } catch (error) {
      setSettings(previousSettings);
      setMessage(error instanceof Error ? error.message : "保存外观设置失败");
      return false;
    }
  }

  async function uploadWallpaper(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("不支持的文件类型，请上传 JPG、PNG 或 WebP 格式图片");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage("图片大小不能超过 10MB");
      return;
    }

    try {
      const response = await api.client.uploadWallpaper(file);
      if (await saveSettings({ ...settings, wallpaperUrl: response.url })) {
        setMessage("壁纸上传成功");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "壁纸上传失败");
    }
  }

  async function removeWallpaper() {
    try {
      await api.client.deleteWallpaper();
      if (await saveSettings({ ...settings, wallpaperUrl: null })) {
        setMessage("壁纸已删除");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "壁纸删除失败");
    }
  }

  async function resetSettings() {
    try {
      if (await saveSettings(defaultAppearanceSettings)) {
        setMessage("已恢复默认设置");
      }
    } catch {
      // saveSettings already reports the error.
    }
  }

  return (
    <div className="space-y-8">
      <SettingsSection title="背景壁纸">
        <div className="space-y-4 px-4 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-base text-gray-900 dark:text-[#e8e9ed]">自定义壁纸</span>
              <span className="text-xs text-gray-500 dark:text-[#8b8d95]">
                上传一张图片作为应用背景，支持 JPG、PNG、WebP 格式
              </span>
            </div>
          </div>
          {settings.wallpaperUrl ? (
            <div className="relative h-40 w-full overflow-hidden rounded-lg border border-gray-200 dark:border-[#2e3035]">
              <img src={settings.wallpaperUrl} alt="自定义壁纸预览" className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity hover:opacity-100">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md bg-red-500 px-3 py-1.5 text-sm font-medium text-white"
                  onClick={() => void removeWallpaper()}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  删除
                </button>
              </div>
            </div>
          ) : (
            <label className="flex h-40 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-500 transition-colors hover:border-pink-300 dark:border-[#2e3035] dark:text-[#8b8d95]">
              <Plus className="mb-2 h-8 w-8 text-gray-400" aria-hidden="true" />
              <span className="text-sm">点击或拖拽上传壁纸</span>
              <input
                aria-label="上传壁纸"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => void uploadWallpaper(event.target.files?.[0])}
              />
            </label>
          )}
        </div>
      </SettingsSection>
      {settings.wallpaperUrl ? (
        <>
          <SettingsSection title="透明度调节">
            <SettingsRow title="侧边栏透明度" description="调节侧边栏背景的不透明度">
              <SettingsSlider
                label="侧边栏透明度"
                value={settings.sidebarOpacity}
                min={0}
                max={100}
                onChange={(value) => void saveSettings({ ...settings, sidebarOpacity: value })}
              />
            </SettingsRow>
            <SettingsRow title="内容区透明度" description="调节主内容区域背景的不透明度" bordered={false}>
              <SettingsSlider
                label="内容区透明度"
                value={settings.contentOpacity}
                min={0}
                max={100}
                onChange={(value) => void saveSettings({ ...settings, contentOpacity: value })}
              />
            </SettingsRow>
          </SettingsSection>
          <SettingsSection title="毛玻璃效果">
            <SettingsRow title="启用毛玻璃效果" description="为背景添加毛玻璃模糊效果">
              <SettingsSwitch
                label="启用毛玻璃效果"
                checked={settings.acrylicEnabled}
                onChange={(checked) => void saveSettings({ ...settings, acrylicEnabled: checked })}
              />
            </SettingsRow>
            <SettingsRow title="模糊程度" description="调节背景壁纸的模糊半径" bordered={false}>
              <SettingsSlider
                label="模糊程度"
                value={settings.blurRadius}
                min={0}
                max={50}
                unit="px"
                onChange={(value) => void saveSettings({ ...settings, blurRadius: value })}
              />
            </SettingsRow>
          </SettingsSection>
        </>
      ) : null}
      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-md border border-gray-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-[#34363c] dark:text-[#d6d7dc] dark:hover:bg-[#2a2c30]"
          onClick={() => void resetSettings()}
        >
          恢复默认设置
        </button>
      </div>
      {message ? <SettingsToast message={message} onClose={() => setMessage(null)} /> : null}
    </div>
  );
}

function getNullableString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function getNumber(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}
