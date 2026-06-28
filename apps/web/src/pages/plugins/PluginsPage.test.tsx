import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PluginsPage, type PluginsPageApi } from ".";

function createApi(): PluginsPageApi {
  return {
    client: {
      fetchGlobalPlugins: vi.fn(async () => ({
        tools: [
          {
            pluginId: "file-tools",
            displayName: "文件工具",
            description: "读写、编辑、搜索、删除文件和目录",
            enabled: true,
            tools: [
              { name: "read", displayName: "读取", description: "读取文件内容" },
              { name: "write", displayName: "写入", description: "写入文件内容" },
            ],
          },
        ],
      })),
      updateGlobalPluginStatus: vi.fn(async (_pluginId, enabled) => ({
        success: true,
        pluginId: "file-tools",
        enabled,
      })),
      fetchSkills: vi.fn(async () => ({
        items: [
          {
            id: "skill-creator",
            name: "skill-creator",
            description: "Creating and authoring new AI skills",
            enabled: true,
            version: "v1.2.0",
            tags: ["元技能"],
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      })),
      fetchMcpServers: vi.fn(async () => [
        {
          id: "mcp-1",
          name: "Filesystem MCP",
          description: "文件系统 MCP 服务器",
          enabled: false,
          status: "stopped",
        },
      ]),
      triggerSkillScan: vi.fn(async () => ({ success: true })),
      toggleSkill: vi.fn(async (_skillId, enabled) => ({ success: true, enabled })),
      toggleMcpServer: vi.fn(async (_serverId, enabled) => ({ id: "mcp-1", enabled })),
      refreshMcpServerTools: vi.fn(async () => ({ success: true })),
    },
  };
}

function renderPluginsPage(initialPath = "/plugins/local-tools", api = createApi()) {
  return {
    api,
    ...render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/plugins/:tab" element={<PluginsPage api={api} />} />
          <Route path="/plugins" element={<PluginsPage api={api} />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>,
    ),
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe("PluginsPage", () => {
  it("shows local tools for /plugins/local-tools", async () => {
    const { api } = renderPluginsPage();

    expect(await screen.findByRole("heading", { name: "插件" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "本地工具" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("文件工具")).toBeInTheDocument();
    expect(screen.getByText("读写、编辑、搜索、删除文件和目录")).toBeInTheDocument();
    expect(screen.getByText("2 个工具")).toBeInTheDocument();
    expect(api.client.fetchGlobalPlugins).toHaveBeenCalledTimes(1);
  });

  it("changes route and content when switching tabs", async () => {
    const user = userEvent.setup();
    renderPluginsPage();

    await screen.findByText("文件工具");
    await user.click(screen.getByRole("button", { name: "Skills" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/plugins/skills");
    });
    expect(screen.getByRole("button", { name: "Skills" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("skill-creator")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "MCP 服务器" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/plugins/mcp");
    });
    expect(screen.getByRole("button", { name: "MCP 服务器" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Filesystem MCP")).toBeInTheDocument();
  });
});
