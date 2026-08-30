import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PluginsPage, type PluginsPageApi } from ".";

function createApi() {
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
            manifest: {
              description: "Creating and authoring new AI skills with proper SKILL.md structure",
            },
            enabled: true,
            version: "v1.2.0",
            builtIn: true,
            tags: ["元技能"],
          },
          {
            id: "custom-skill",
            name: "custom-skill",
            manifest: {
              description: "A user-installed workflow skill",
            },
            enabled: true,
            version: "v0.1.0",
            builtIn: false,
            tags: ["用户"],
          },
        ],
        total: 2,
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
      createMcpServer: vi.fn(async (server) => ({ id: "mcp-created", ...server })),
      triggerSkillScan: vi.fn(async () => ({ success: true })),
      toggleSkill: vi.fn(async (_skillId, enabled) => ({ success: true, enabled })),
      reloadSkill: vi.fn(async (_skillId) => ({ success: true })),
      installSkill: vi.fn(async (_file, _force) => ({ success: true, message: "安装成功" })),
      installSkillFromUrl: vi.fn(async (_url, _force) => ({ success: true, message: "安装成功" })),
      installSkillFromRegistry: vi.fn(async (_request) => ({ success: true, message: "安装成功" })),
      uninstallSkill: vi.fn(async (_skillId) => ({ success: true, message: "卸载成功" })),
      fetchSkillDocumentation: vi.fn(async (_skillId) => ({
        content:
          "---\nname: skill-creator\ndescription: Creating and authoring new AI skills\nversion: 1.2.0\nauthor: system\ntags:\n  - system\n  - meta\n---\n\n# Skill Creator\n\nThis skill guides you through authoring skills.",
      })),
      toggleMcpServer: vi.fn(async (_serverId, enabled) => ({ id: "mcp-1", enabled })),
      refreshMcpServerTools: vi.fn(async () => ({ success: true })),
    },
    market: {
      fetchMarketSkills: vi.fn(async (_useCache = true) => [
        {
          id: "content-research-writer",
          name: "内容研究写作助手",
          description: "协助撰写高质量内容，进行研究、添加引用、改进开头、迭代优化。",
          icon: null,
          labels: ["内容与编辑", "效率工具"],
          installUrls: [
            { type: "zip" as const, url: "https://ai.dingd.cn/skills/content-research-writer.zip" },
            { type: "git" as const, url: "https://github.com/example/content-research-writer" },
          ],
          detailUrl: "https://ai.dingd.cn/skills/content-research-writer",
          version: "v1.0.0",
        },
        {
          id: "skill-creator",
          name: "技能创建器",
          description: "创建和维护 Skills。",
          icon: null,
          labels: ["元技能"],
          installUrls: [{ type: "zip" as const, url: "https://ai.dingd.cn/skills/skill-creator.zip" }],
          version: "v1.2.0",
        },
        {
          id: "custom-skill",
          name: "自定义技能",
          description: "用户安装技能的新版本。",
          icon: null,
          labels: ["用户"],
          installUrls: [{ type: "zip" as const, url: "https://ai.dingd.cn/skills/custom-skill.zip" }],
          version: "v0.2.0",
        },
      ]),
    },
  };
}

function renderPluginsPage(initialPath = "/plugins/local-tools", api = createApi()) {
  return {
    api,
    ...render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/plugins/:tab" element={<PluginsPage api={api as PluginsPageApi} />} />
          <Route path="/plugins" element={<PluginsPage api={api as PluginsPageApi} />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>,
    ),
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe("PluginsPage", () => {
  it("shows local tools for /plugins/local-tools", async () => {
    const { api } = renderPluginsPage();

    expect(await screen.findByRole("heading", { name: "插件" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "本地工具" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("文件工具")).toBeInTheDocument();
    expect(screen.getByText("读写、编辑、搜索、删除文件和目录")).toBeInTheDocument();
    expect(screen.getByText("2 个工具")).toBeInTheDocument();
    expect(api.client.fetchGlobalPlugins).toHaveBeenCalledTimes(1);
  });

  it("changes route and content when switching tabs", async () => {
    const user = userEvent.setup();
    renderPluginsPage();

    await screen.findByText("文件工具");
    await user.click(screen.getByRole("tab", { name: "Skills" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/plugins/skills");
    });
    expect(screen.getByRole("tab", { name: "Skills" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("heading", { name: "skill-creator" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "MCP 服务器" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/plugins/mcp");
    });
    expect(screen.getByRole("tab", { name: "MCP 服务器" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Filesystem MCP")).toBeInTheDocument();
  });

  it("shows skill manifest descriptions and reloads a skill", async () => {
    const user = userEvent.setup();
    const { api } = renderPluginsPage("/plugins/skills");

    expect(await screen.findByRole("heading", { name: "skill-creator" })).toBeInTheDocument();
    expect(screen.getByText("Creating and authoring new AI skills with proper SKILL.md structure")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "重载 skill-creator" }));

    await waitFor(() => {
      expect(api.client.reloadSkill).toHaveBeenCalledWith("skill-creator");
    });
    expect(api.client.fetchSkills).toHaveBeenCalledTimes(2);
  });

  it("opens a Guada-style SKILL.md documentation dialog", async () => {
    const user = userEvent.setup();
    const { api } = renderPluginsPage("/plugins/skills");

    expect(await screen.findByRole("heading", { name: "skill-creator" })).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "SKILL.md" })[0]);

    await waitFor(() => {
      expect(api.client.fetchSkillDocumentation).toHaveBeenCalledWith("skill-creator");
    });

    const dialog = await screen.findByRole("dialog", { name: "skill-creator - SKILL.md" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "name" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "skill-creator" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "tags" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "system, meta" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Skill Creator" })).toBeInTheDocument();
    expect(screen.getByText("This skill guides you through authoring skills.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("dialog", { name: "skill-creator - SKILL.md" })).not.toBeInTheDocument();
  });

  it("keeps skill and MCP actions in the section header instead of the page header", async () => {
    const user = userEvent.setup();
    renderPluginsPage("/plugins/skills");

    expect(await screen.findByRole("heading", { name: "skill-creator" })).toBeInTheDocument();
    const pageHeader = screen.getByTestId("workspace-page-header");
    expect(within(pageHeader).queryByRole("button", { name: "安装" })).not.toBeInTheDocument();
    expect(within(pageHeader).queryByRole("button", { name: "扫描" })).not.toBeInTheDocument();
    expect(within(pageHeader).queryByRole("button", { name: "使用说明" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "安装" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "扫描" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "使用说明" })).toHaveLength(1);

    await user.click(screen.getByRole("tab", { name: "MCP 服务器" }));

    await screen.findByRole("heading", { name: "MCP 服务器" });
    expect(within(pageHeader).queryByRole("button", { name: "导入配置" })).not.toBeInTheDocument();
    expect(within(pageHeader).queryByRole("button", { name: "添加服务器" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "导入配置" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "添加服务器" })).toHaveLength(1);
  });

  it("imports Guada-style MCP server configuration JSON", async () => {
    const user = userEvent.setup();
    const { api } = renderPluginsPage("/plugins/mcp");

    expect(await screen.findByText("Filesystem MCP")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "导入配置" }));

    const dialog = screen.getByRole("dialog", { name: "导入 MCP 服务器配置" });
    expect(within(dialog).getByText("请粘贴 MCP 服务器配置 JSON 数据，支持以下格式：")).toBeInTheDocument();
    expect(within(dialog).getByText(/标准格式/)).toBeInTheDocument();
    expect(within(dialog).getByText(/单个服务器对象格式/)).toBeInTheDocument();

    fireEvent.change(within(dialog).getByPlaceholderText(/请粘贴 JSON 配置/), {
      target: {
        value: JSON.stringify({
          mcpServers: {
            WebSearch: {
              type: "streamableHttp",
              description: "描述信息",
              isActive: true,
              name: "阿里云百炼_联网搜索",
              baseUrl: "https://dashscope.aliyuncs.com/api/v1/mcps/WebSearch/mcp",
              headers: {
                Authorization: "Bearer sk-xxx",
              },
            },
          },
        }),
      },
    });
    await user.click(within(dialog).getByRole("button", { name: "导入" }));

    await waitFor(() => {
      expect(api.client.createMcpServer).toHaveBeenCalledWith({
        name: "阿里云百炼_联网搜索",
        url: "https://dashscope.aliyuncs.com/api/v1/mcps/WebSearch/mcp",
        description: "描述信息",
        headers: { Authorization: "Bearer sk-xxx" },
        enabled: true,
        type: "streamableHttp",
      });
    });
    expect(await screen.findByText("成功导入 1 个服务器")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "导入 MCP 服务器配置" })).not.toBeInTheDocument();
    expect(api.client.fetchMcpServers).toHaveBeenCalledTimes(2);
  });

  it("adds an MCP server with Guada-style form fields", async () => {
    const user = userEvent.setup();
    const { api } = renderPluginsPage("/plugins/mcp");

    expect(await screen.findByText("Filesystem MCP")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "添加服务器" }));

    const dialog = screen.getByRole("dialog", { name: "添加 MCP 服务器" });
    await user.type(within(dialog).getByLabelText("服务器名称"), "阿里云百炼_联网搜索");
    await user.type(
      within(dialog).getByLabelText("服务地址"),
      "https://dashscope.aliyuncs.com/api/v1/mcps/WebSearch/mcp",
    );
    await user.type(
      within(dialog).getByLabelText("HTTP 请求头"),
      "Authorization: Bearer sk-xxx\nX-API-Key: your_api_key",
    );
    await user.click(within(dialog).getByRole("combobox", { name: "协议类型" }));
    await user.click(screen.getByRole("option", { name: "可流式传输的 HTTP (streamableHttp)" }));
    await user.type(within(dialog).getByLabelText("描述信息"), "联网搜索");
    await user.click(within(dialog).getByRole("button", { name: "确定" }));

    await waitFor(() => {
      expect(api.client.createMcpServer).toHaveBeenCalledWith({
        name: "阿里云百炼_联网搜索",
        url: "https://dashscope.aliyuncs.com/api/v1/mcps/WebSearch/mcp",
        type: "streamableHttp",
        description: "联网搜索",
        headers: {
          Authorization: "Bearer sk-xxx",
          "X-API-Key": "your_api_key",
        },
        command: null,
        args: null,
        env: null,
        cwd: null,
        enabled: true,
      });
    });
    expect(await screen.findByText("添加成功")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "添加 MCP 服务器" })).not.toBeInTheDocument();
    expect(api.client.fetchMcpServers).toHaveBeenCalledTimes(2);
  });

  it("installs a skill from a zip file with force overwrite", async () => {
    const user = userEvent.setup();
    const { api } = renderPluginsPage("/plugins/skills");

    expect(await screen.findByRole("heading", { name: "skill-creator" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "安装" }));

    const dialog = screen.getByRole("dialog", { name: "安装 Skill" });
    expect(within(dialog).getByText("请上传 ZIP 格式的 Skill 包。ZIP 文件应包含一个 Skill 目录，其中必须有 SKILL.md 文件。")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "安装" })).toBeDisabled();

    const zipFile = new File(["zip-bytes"], "skill-pack.zip", { type: "application/zip" });
    await user.upload(within(dialog).getByLabelText("上传 Skill ZIP 文件"), zipFile);

    expect(within(dialog).getByText("skill-pack.zip")).toBeInTheDocument();
    expect(within(dialog).getByText("9 B")).toBeInTheDocument();
    await user.click(within(dialog).getByLabelText("强制覆盖（如果技能已存在则替换）"));
    await user.click(within(dialog).getByRole("button", { name: "安装" }));

    await waitFor(() => {
      expect(api.client.installSkill).toHaveBeenCalledWith(zipFile, true);
    });
    expect(await screen.findByText("安装成功")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "安装 Skill" })).not.toBeInTheDocument();
    expect(api.client.fetchSkills).toHaveBeenCalledTimes(2);
  });

  it("keeps the install dialog open when skill installation fails", async () => {
    const user = userEvent.setup();
    const { api } = renderPluginsPage("/plugins/skills");
    api.client.installSkill.mockRejectedValueOnce(new Error("Skill 已存在"));

    expect(await screen.findByRole("heading", { name: "skill-creator" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "安装" }));
    const dialog = screen.getByRole("dialog", { name: "安装 Skill" });
    await user.upload(within(dialog).getByLabelText("上传 Skill ZIP 文件"), new File(["zip"], "existing.zip", { type: "application/zip" }));
    await user.click(within(dialog).getByRole("button", { name: "安装" }));

    expect(await within(dialog).findByText("Skill 已存在")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "安装 Skill" })).toBeInTheDocument();
  });

  it("only shows uninstall for non built-in skills and confirms before uninstalling", async () => {
    const user = userEvent.setup();
    const { api } = renderPluginsPage("/plugins/skills");

    expect(await screen.findByRole("heading", { name: "skill-creator" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "custom-skill" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "卸载 skill-creator" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "卸载 custom-skill" }));

    const dialog = screen.getByRole("dialog", { name: "确认卸载" });
    expect(within(dialog).getByText('确定要卸载 Skill "custom-skill" 吗？此操作将删除该 Skill 的所有文件。')).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "确定" }));

    await waitFor(() => {
      expect(api.client.uninstallSkill).toHaveBeenCalledWith("custom-skill");
    });
    expect(await screen.findByText("卸载成功")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "确认卸载" })).not.toBeInTheDocument();
    expect(api.client.fetchSkills).toHaveBeenCalledTimes(2);
  });

  it("keeps the uninstall dialog open when skill uninstallation fails", async () => {
    const user = userEvent.setup();
    const { api } = renderPluginsPage("/plugins/skills");
    api.client.uninstallSkill.mockRejectedValueOnce(new Error("不能卸载正在使用的 Skill"));

    expect(await screen.findByRole("heading", { name: "custom-skill" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "卸载 custom-skill" }));
    const dialog = screen.getByRole("dialog", { name: "确认卸载" });
    await user.click(within(dialog).getByRole("button", { name: "确定" }));

    expect(await within(dialog).findByText("不能卸载正在使用的 Skill")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "确认卸载" })).toBeInTheDocument();
  });

  it("renders Guada-style recommended skills and refreshes the market list", async () => {
    const user = userEvent.setup();
    const { api } = renderPluginsPage("/plugins/skills");

    expect(await screen.findByRole("heading", { name: "技能推荐" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "内容研究写作助手" })).toBeInTheDocument();
    expect(screen.getByText("content-research-writer")).toBeInTheDocument();
    expect(screen.getByText("协助撰写高质量内容，进行研究、添加引用、改进开头、迭代优化。")).toBeInTheDocument();
    expect(screen.getByText("内容与编辑")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "安装 内容研究写作助手" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新安装 技能创建器" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "升级 自定义技能" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "换一批" }));

    await waitFor(() => {
      expect(api.market.fetchMarketSkills).toHaveBeenLastCalledWith(false);
    });
  });

  it("installs a recommended skill from its zip URL", async () => {
    const user = userEvent.setup();
    const { api } = renderPluginsPage("/plugins/skills");

    expect(await screen.findByRole("heading", { name: "内容研究写作助手" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "安装 内容研究写作助手" }));

    const dialog = screen.getByRole("dialog", { name: "安装技能" });
    expect(within(dialog).getByRole("heading", { name: "内容研究写作助手" })).toBeInTheDocument();
    expect(within(dialog).getByText("协助撰写高质量内容，进行研究、添加引用、改进开头、迭代优化。")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "安装" }));

    await waitFor(() => {
      expect(api.client.installSkillFromUrl).toHaveBeenCalledWith(
        "https://ai.dingd.cn/skills/content-research-writer.zip",
        false,
      );
    });
    expect(await screen.findByText("安装成功")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "安装技能" })).not.toBeInTheDocument();
    expect(api.client.fetchSkills).toHaveBeenCalledTimes(2);
  });

  it("installs a skill from a skills.sh identifier", async () => {
    const user = userEvent.setup();
    const { api } = renderPluginsPage("/plugins/skills");

    expect(await screen.findByRole("heading", { name: "skill-creator" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "从 Skills.sh 安装" }));

    const dialog = screen.getByRole("dialog", { name: "从 Skills.sh 安装" });
    await user.type(
      within(dialog).getByLabelText("Skills.sh 标识"),
      "anthropics/skills/skill-creator",
    );
    await user.click(within(dialog).getByRole("button", { name: "安装" }));

    await waitFor(() => {
      expect(api.client.installSkillFromRegistry).toHaveBeenCalledWith({
        source: "skills-sh",
        identifier: "anthropics/skills/skill-creator",
        force: false,
      });
    });
    expect(await screen.findByText("安装成功")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "从 Skills.sh 安装" })).not.toBeInTheDocument();
    expect(api.client.fetchSkills).toHaveBeenCalledTimes(2);
  });

  it("installs a skill from a GitHub repository path", async () => {
    const user = userEvent.setup();
    const { api } = renderPluginsPage("/plugins/skills");

    expect(await screen.findByRole("heading", { name: "skill-creator" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "从 GitHub 安装" }));

    const dialog = screen.getByRole("dialog", { name: "从 GitHub 安装" });
    await user.type(
      within(dialog).getByLabelText("GitHub 仓库或路径"),
      "https://github.com/acme/skills/tree/main/frontend-design",
    );
    await user.click(within(dialog).getByRole("button", { name: "安装" }));

    await waitFor(() => {
      expect(api.client.installSkillFromRegistry).toHaveBeenCalledWith({
        source: "github",
        identifier: "https://github.com/acme/skills/tree/main/frontend-design",
        force: false,
      });
    });
    expect(await screen.findByText("安装成功")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "从 GitHub 安装" })).not.toBeInTheDocument();
    expect(api.client.fetchSkills).toHaveBeenCalledTimes(2);
  });

  it("shows loading and a success toast when scanning skills", async () => {
    const deferred = createDeferred<{ success: boolean }>();
    const api = createApi();
    api.client.triggerSkillScan.mockReturnValueOnce(deferred.promise);
    const user = userEvent.setup();
    renderPluginsPage("/plugins/skills", api);

    expect(await screen.findByRole("heading", { name: "skill-creator" })).toBeInTheDocument();
    vi.useFakeTimers();
    try {
      const scanButton = screen.getAllByRole("button", { name: "扫描" })[0];
      fireEvent.click(scanButton);

      expect(scanButton).toBeDisabled();
      expect(scanButton.querySelector(".animate-spin")).not.toBeNull();

      await act(async () => {
        deferred.resolve({ success: true });
        await flushPromises();
      });

      expect(screen.getByText("扫描完成")).toBeInTheDocument();
      expect(scanButton).not.toBeDisabled();
      expect(api.client.fetchSkills).toHaveBeenCalledTimes(2);

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.queryByText("扫描完成")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
