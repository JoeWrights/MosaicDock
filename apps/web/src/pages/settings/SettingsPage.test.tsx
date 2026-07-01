import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsPage, type SettingsPageApi } from ".";
import { SettingsToast } from "./settings-components";

function createApi(): SettingsPageApi {
  return {
    client: {
      fetchGroupSettings: vi.fn(async (group: string) => {
        if (group === "system") return { autoLoginEnabled: false, workspaceBaseDir: "" };
        if (group === "models") return { defaultChatModelId: "model-1" };
        if (group === "ocr") return { provider: "none" };
        if (group === "appearance") return {};
        return {};
      }),
      updateGroupSettings: vi.fn(async (_group: string, data: Record<string, unknown>) => data),
      fetchAllModels: vi.fn(async () => ({
        items: [
          {
            id: "provider-1",
            name: "硅基流动",
            provider: "siliconflow",
            protocol: "openai",
            apiUrl: "https://api.siliconflow.cn/v1",
            apiKeySet: true,
            isActive: true,
            models: [
              {
                id: "model-1",
                modelName: "DeepSeek-V3.2",
                modelType: "text",
                providerId: "provider-1",
                isActive: true,
              },
              {
                id: "model-2",
                modelName: "Qwen-VL",
                modelType: "text",
                providerId: "provider-1",
                isActive: true,
                config: { inputCapabilities: ["text", "image"], outputCapabilities: ["text"] },
              },
            ],
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      })),
      uploadWallpaper: vi.fn(async () => ({ url: "/uploads/wallpaper.png" })),
      deleteWallpaper: vi.fn(async () => ({ success: true })),
    },
  } as SettingsPageApi;
}

function renderSettings(initialPath = "/setting/general", api = createApi()) {
  return {
    api,
    ...render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/setting/:tab" element={<SettingsPage api={api} />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>,
    ),
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-path">{location.pathname}</div>;
}

describe("SettingsPage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the guada-style settings shell and syncs tabs with the URL", async () => {
    const user = userEvent.setup();
    renderSettings("/setting/general");

    expect(screen.getByRole("heading", { name: "系统设置" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "通用设置" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "默认模型" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "OCR 设置" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "外观" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "关于" })).toBeInTheDocument();
    expect(screen.getByText("登录")).toBeInTheDocument();
    expect(screen.getByText("工作目录")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "OCR 设置" }));

    expect(screen.getByTestId("location-path")).toHaveTextContent("/setting/ocr");
    expect(screen.getByRole("tab", { name: "OCR 设置" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("OCR 服务")).toBeInTheDocument();
  });

  it("loads and auto-saves general settings with path validation", async () => {
    const api = createApi();
    api.client.fetchGroupSettings = vi.fn(async (group: string) => {
      if (group === "system") {
        return { autoLoginEnabled: false, workspaceBaseDir: "/Users/joewright/workspaces" };
      }
      return {};
    });
    const user = userEvent.setup();
    renderSettings("/setting/general", api);

    const autoLogin = await screen.findByRole("switch", { name: "免登录模式" });
    expect(autoLogin).toHaveAttribute("aria-checked", "false");
    const workspaceInput = screen.getByLabelText("工作目录基路径");
    const folderButton = screen.getByRole("button", { name: "选择文件夹" });
    expect(workspaceInput).toHaveValue("/Users/joewright/workspaces");
    expect(workspaceInput.parentElement).toHaveClass("max-w-xl");
    expect(folderButton).toHaveClass("whitespace-nowrap");
    expect(folderButton).toHaveClass("shrink-0");

    await user.click(folderButton);
    const folderToast = screen.getByRole("status");
    expect(folderToast).toHaveTextContent("当前环境不支持文件夹选择，请直接输入路径");
    expect(folderToast).toHaveClass("fixed");
    expect(folderToast).toHaveClass("top-4");

    await user.click(autoLogin);

    await waitFor(() => {
      expect(api.client.updateGroupSettings).toHaveBeenCalledWith("system", {
        autoLoginEnabled: true,
        workspaceBaseDir: "/Users/joewright/workspaces",
      });
    });

    await user.clear(screen.getByLabelText("工作目录基路径"));
    await user.type(screen.getByLabelText("工作目录基路径"), "relative/path");

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("工作目录基路径必须是绝对路径");
    });
    expect(api.client.updateGroupSettings).not.toHaveBeenCalledWith("system", {
      autoLoginEnabled: true,
      workspaceBaseDir: "relative/path",
    });
  });

  it("auto-dismisses settings toast after a short delay", async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();

    render(<SettingsToast message="当前环境不支持文件夹选择，请直接输入路径" onClose={onClose} />);

    expect(screen.getByRole("status")).toHaveTextContent("当前环境不支持文件夹选择，请直接输入路径");
    await vi.advanceTimersByTimeAsync(3000);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("selects and saves default model settings", async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderSettings("/setting/default-models", api);

    expect(await screen.findByText("对话")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /默认对话模型/ })).toHaveTextContent("DeepSeek-V3.2");

    await user.click(screen.getByRole("button", { name: /默认对话模型/ }));
    const dialog = await screen.findByRole("dialog", { name: "选择模型" });
    await user.click(within(dialog).getByRole("button", { name: /Qwen-VL/ }));

    await waitFor(() => {
      expect(api.client.updateGroupSettings).toHaveBeenCalledWith("models", {
        defaultChatModelId: "model-2",
        defaultTitleSummaryModelId: null,
        defaultVisualAssistantModelId: null,
        defaultHistoryCompressionModelId: null,
      });
    });
  });

  it("loads and saves OCR settings", async () => {
    const api = createApi();
    api.client.fetchGroupSettings = vi.fn(async (group: string) => {
      if (group === "ocr") return { provider: "none", umiHost: "127.0.0.1", umiPort: 1224 };
      return {};
    });
    const user = userEvent.setup();
    renderSettings("/setting/ocr", api);

    expect(await screen.findByText("OCR 服务")).toBeInTheDocument();
    expect(document.querySelector("select")).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "OCR 提供商" }));
    const ocrListbox = screen.getByRole("listbox", { name: "OCR 提供商" });
    expect(ocrListbox).toHaveClass("rounded-xl");
    await user.click(screen.getByRole("option", { name: "UMI-OCR（本地）" }));

    expect(await screen.findByLabelText("服务地址")).toHaveValue("127.0.0.1");
    expect(screen.getByLabelText("服务端口")).toHaveValue(1224);

    await user.clear(screen.getByLabelText("服务地址"));
    await user.type(screen.getByLabelText("服务地址"), "192.168.1.10");

    await waitFor(() => {
      expect(api.client.updateGroupSettings).toHaveBeenCalledWith("ocr", {
        provider: "umi",
        umiHost: "192.168.1.10",
        umiPort: 1224,
      });
    });
  });

  it("uploads and manages appearance settings", async () => {
    const api = createApi();
    api.client.fetchGroupSettings = vi.fn(async (group: string) => {
      if (group === "appearance") {
        return {
          wallpaperUrl: null,
          sidebarOpacity: 100,
          contentOpacity: 100,
          acrylicEnabled: true,
          blurRadius: 20,
        };
      }
      return {};
    });
    const user = userEvent.setup();
    renderSettings("/setting/appearance", api);

    expect(await screen.findByText("背景壁纸")).toBeInTheDocument();
    const file = new File(["image"], "wallpaper.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("上传壁纸"), file);

    expect(api.client.uploadWallpaper).toHaveBeenCalledWith(file);
    expect(await screen.findByAltText("自定义壁纸预览")).toBeInTheDocument();
    expect(screen.getByLabelText("侧边栏透明度")).toHaveValue("100");

    await user.click(screen.getByRole("switch", { name: "启用毛玻璃效果" }));

    await waitFor(() => {
      expect(api.client.updateGroupSettings).toHaveBeenCalledWith("appearance", {
        wallpaperUrl: "/uploads/wallpaper.png",
        sidebarOpacity: 100,
        contentOpacity: 100,
        acrylicEnabled: false,
        blurRadius: 20,
      });
    });
  });

  it("renders the guada-style about fallback in web", () => {
    renderSettings("/setting/about");

    expect(screen.getByText("此功能仅在桌面客户端中可用")).toBeInTheDocument();
  });
});
