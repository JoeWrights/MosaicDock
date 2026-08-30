import { Grid2X2, Image, Info, ScanText, Settings } from "lucide-react";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { mosaicApi } from "@mosaic-dock/api-client";
import type { ModelProvider, PaginatedResponse } from "@mosaic-dock/shared";
import { RoutePath } from "../../constants/routes";
import { cn } from "../../lib/utils";
import { AboutPanel } from "./AboutPanel";
import { AppearanceSettingsPanel } from "./AppearanceSettingsPanel";
import { DefaultModelSettingsPanel } from "./DefaultModelSettingsPanel";
import { GeneralSettingsPanel } from "./GeneralSettingsPanel";
import { OcrSettingsPanel } from "./OcrSettingsPanel";

export interface SettingsPageApi {
  client: {
    fetchGroupSettings: (group: string) => Promise<Record<string, unknown>>;
    updateGroupSettings: (group: string, data: Record<string, unknown>) => Promise<Record<string, unknown>>;
    fetchAllModels: () => Promise<PaginatedResponse<ModelProvider>>;
    uploadWallpaper: (file: File) => Promise<{ url: string }>;
    deleteWallpaper: () => Promise<{ success: boolean }>;
  };
}

interface SettingsPageProps {
  api?: SettingsPageApi;
}

const tabs = [
  { value: "general", label: "通用设置", icon: Settings },
  { value: "default-models", label: "默认模型", icon: Grid2X2 },
  { value: "ocr", label: "OCR 设置", icon: ScanText },
  { value: "appearance", label: "外观", icon: Image },
  { value: "about", label: "关于", icon: Info },
] as const;

type SettingsTab = (typeof tabs)[number]["value"];

export function SettingsPage({ api = mosaicApi }: SettingsPageProps) {
  const { tab } = useParams();
  const navigate = useNavigate();
  const currentTab = isSettingsTab(tab) ? tab : "general";

  useEffect(() => {
    if (!isSettingsTab(tab)) {
      void navigate(RoutePath.SETTING_GENERAL, { replace: true });
    }
  }, [navigate, tab]);

  return (
    <div className="flex h-screen flex-col bg-white text-foreground dark:bg-[#1e1f23] dark:text-[#e8e9ed]">
      <header className="flex h-12 shrink-0 items-center border-b border-slate-100 px-5 dark:border-[#2e3035]">
        <h1 className="text-sm font-semibold">系统设置</h1>
      </header>
      <main className="mx-auto flex min-h-0 w-full max-w-[880px] flex-1 flex-col">
        <div className="p-4">
          <div role="tablist" aria-label="系统设置" className="flex border-b border-slate-200 dark:border-[#2e3035]">
            {tabs.map((item) => {
              const Icon = item.icon;
              const selected = item.value === currentTab;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={cn(
                    "flex h-11 items-center gap-2 border-b-2 px-[18px] text-[15px] transition-colors",
                    selected
                      ? "border-pink-500 text-pink-500"
                      : "border-transparent text-slate-600 hover:text-slate-900 dark:text-[#d6d7dc] dark:hover:text-[#e8e9ed]",
                  )}
                  onClick={() => navigate(`${RoutePath.SETTING}/${item.value}`)}
                >
                  <Icon className="h-[17px] w-[17px]" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-6 pt-3">
          {currentTab === "general" ? <GeneralSettingsPanel api={api} /> : null}
          {currentTab === "default-models" ? <DefaultModelSettingsPanel api={api} /> : null}
          {currentTab === "ocr" ? <OcrSettingsPanel api={api} /> : null}
          {currentTab === "appearance" ? <AppearanceSettingsPanel api={api} /> : null}
          {currentTab === "about" ? <AboutPanel /> : null}
        </div>
      </main>
    </div>
  );
}

function isSettingsTab(tab: string | undefined): tab is SettingsTab {
  return tabs.some((item) => item.value === tab);
}

export default SettingsPage;
