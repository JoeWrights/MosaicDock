import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Code2,
  Dumbbell,
  Plus,
  RefreshCw,
  RotateCw,
  Upload,
  Wrench,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { mosaicApi, type ApiClient } from "@mosaic-dock/api-client";
import type { CharacterPluginDefinition, McpServer } from "@mosaic-dock/shared";
import { WorkspacePageHeader } from "../../components/layout/WorkspacePageHeader";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/empty-state";
import { Spinner } from "../../components/ui/spinner";
import { Switch } from "../../components/ui/switch";
import { RoutePath } from "../../constants/routes";
import { cn } from "../../lib/utils";

type PluginTab = "local-tools" | "skills" | "mcp";

interface SkillItem {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
  version?: string;
  builtIn?: boolean;
  tags?: string[];
}

interface GlobalPluginsResponse {
  tools?: CharacterPluginDefinition[];
}

export interface PluginsPageApi {
  client: Pick<
    ApiClient,
    | "fetchGlobalPlugins"
    | "updateGlobalPluginStatus"
    | "fetchSkills"
    | "triggerSkillScan"
    | "toggleSkill"
    | "fetchMcpServers"
    | "toggleMcpServer"
    | "refreshMcpServerTools"
  >;
}

interface PluginsPageProps {
  api?: PluginsPageApi;
}

const tabs: Array<{
  key: PluginTab;
  label: string;
  icon: typeof Wrench;
}> = [
  { key: "local-tools", label: "本地工具", icon: Wrench },
  { key: "skills", label: "Skills", icon: Code2 },
  { key: "mcp", label: "MCP 服务器", icon: Dumbbell },
];

export function PluginsPage({ api = mosaicApi }: PluginsPageProps) {
  const { tab } = useParams();
  const navigate = useNavigate();
  const activeTab = isPluginTab(tab) ? tab : "local-tools";

  useEffect(() => {
    if (!isPluginTab(tab)) {
      void navigate(RoutePath.PLUGINS_LOCAL_TOOLS, { replace: true });
    }
  }, [navigate, tab]);

  function changeTab(nextTab: PluginTab) {
    void navigate(`${RoutePath.PLUGINS}/${nextTab}`);
  }

  return (
    <div className="flex h-screen min-h-0 flex-col bg-white px-6 dark:bg-[#1e1f23]">
      <WorkspacePageHeader
        title="插件"
        actions={activeTab === "mcp" ? <McpActions /> : activeTab === "skills" ? <SkillActions /> : null}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="sticky top-0 z-10 border-b border-border bg-white dark:bg-[#1e1f23]">
          <div role="tablist" aria-label="插件分类" className="flex gap-1">
            {tabs.map((item) => {
              const Icon = item.icon;
              const selected = item.key === activeTab;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={cn(
                    "inline-flex h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium transition-colors",
                    selected
                      ? "border-pink-500 text-pink-500"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => changeTab(item.key)}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto py-4">
          {activeTab === "local-tools" ? <LocalToolsPanel api={api} /> : null}
          {activeTab === "skills" ? <SkillsPanel api={api} /> : null}
          {activeTab === "mcp" ? <McpServersPanel api={api} /> : null}
        </div>
      </div>
    </div>
  );
}

function LocalToolsPanel({ api }: { api: PluginsPageApi }) {
  const [tools, setTools] = useState<CharacterPluginDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const enabledCount = useMemo(() => tools.filter((tool) => tool.enabled !== false).length, [tools]);

  useEffect(() => {
    let cancelled = false;

    async function loadTools() {
      setLoading(true);
      setError(null);
      try {
        const response = await api.client.fetchGlobalPlugins<GlobalPluginsResponse>();
        if (!cancelled) setTools(normalizeGlobalPlugins(response));
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "本地工具加载失败");
          setTools([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTools();

    return () => {
      cancelled = true;
    };
  }, [api]);

  async function updateTool(pluginId: string, enabled: boolean) {
    setTools((current) =>
      current.map((tool) => (tool.pluginId === pluginId ? { ...tool, enabled } : tool)),
    );
    try {
      await api.client.updateGlobalPluginStatus(pluginId, enabled);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "本地工具状态更新失败");
      setTools((current) =>
        current.map((tool) => (tool.pluginId === pluginId ? { ...tool, enabled: !enabled } : tool)),
      );
    }
  }

  return (
    <PluginSection
      title="本地工具"
      description="全局工具设置决定了哪些工具对所有角色可用，角色级别的工具设置会在此基础上进一步限制。"
      meta={`${enabledCount}/${tools.length} 已启用`}
      loading={loading}
      error={error}
      emptyTitle="暂无本地工具"
      empty={tools.length === 0}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tools.map((tool) => (
          <PluginCard
            key={tool.pluginId}
            title={tool.displayName || tool.pluginId}
            description={tool.description || "本地能力工具"}
            enabled={tool.enabled !== false}
            badge={`${tool.tools?.length ?? 0} 个工具`}
            onEnabledChange={(enabled) => void updateTool(tool.pluginId, enabled)}
          />
        ))}
      </div>
    </PluginSection>
  );
}

function SkillsPanel({ api }: { api: PluginsPageApi }) {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const enabledCount = useMemo(() => skills.filter((skill) => skill.enabled !== false).length, [skills]);

  async function loadSkills() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.client.fetchSkills();
      setSkills(normalizeSkills(response));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Skills 加载失败");
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSkills();
  }, [api]);

  async function toggleSkill(skillId: string, enabled: boolean) {
    setSkills((current) =>
      current.map((skill) => (skill.id === skillId ? { ...skill, enabled } : skill)),
    );
    try {
      await api.client.toggleSkill(skillId, enabled);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Skill 状态更新失败");
      setSkills((current) =>
        current.map((skill) => (skill.id === skillId ? { ...skill, enabled: !enabled } : skill)),
      );
    }
  }

  async function scanSkills() {
    try {
      await api.client.triggerSkillScan();
      await loadSkills();
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "刷新 Skills 失败");
    }
  }

  return (
    <PluginSection
      title="Skills"
      description="Skills 是系统自动发现的本地技能模块，可为助手提供特定工作流、知识和执行规范。"
      meta={`${enabledCount}/${skills.length} 已启用`}
      loading={loading}
      error={error}
      emptyTitle="暂无 Skills"
      empty={skills.length === 0}
      action={
        <Button variant="secondary" size="sm" onClick={() => void scanSkills()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          扫描
        </Button>
      }
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {skills.map((skill) => (
          <PluginCard
            key={skill.id}
            title={skill.name}
            description={skill.description || "本地 Skill"}
            enabled={skill.enabled !== false}
            badge={skill.version || (skill.builtIn ? "内置" : "用户")}
            tags={skill.tags}
            onEnabledChange={(enabled) => void toggleSkill(skill.id, enabled)}
          />
        ))}
      </div>
    </PluginSection>
  );
}

function McpServersPanel({ api }: { api: PluginsPageApi }) {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const enabledCount = useMemo(() => servers.filter((server) => server.enabled === true).length, [servers]);

  async function loadServers() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.client.fetchMcpServers();
      setServers(Array.isArray(response) ? response : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "MCP 服务器加载失败");
      setServers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadServers();
  }, [api]);

  async function toggleServer(serverId: string, enabled: boolean) {
    setServers((current) =>
      current.map((server) => (server.id === serverId ? { ...server, enabled } : server)),
    );
    try {
      await api.client.toggleMcpServer(serverId, enabled);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "MCP 服务器状态更新失败");
      setServers((current) =>
        current.map((server) => (server.id === serverId ? { ...server, enabled: !enabled } : server)),
      );
    }
  }

  async function refreshServer(serverId: string) {
    try {
      await api.client.refreshMcpServerTools(serverId);
      await loadServers();
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "刷新 MCP 工具失败");
    }
  }

  return (
    <PluginSection
      title="MCP 服务器"
      description="通过 Model Context Protocol 连接外部工具和服务。"
      meta={`${enabledCount}/${servers.length} 已启用`}
      loading={loading}
      error={error}
      emptyTitle="暂无 MCP 服务器"
      empty={servers.length === 0}
      action={
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <Upload className="h-4 w-4" aria-hidden="true" />
            导入配置
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4" aria-hidden="true" />
            添加服务器
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {servers.map((server) => (
          <PluginCard
            key={server.id}
            title={server.name}
            description={server.description || "MCP 服务器"}
            enabled={server.enabled === true}
            badge={typeof server.status === "string" ? server.status : "未配置状态"}
            onEnabledChange={(enabled) => void toggleServer(server.id, enabled)}
            footer={
              <Button variant="ghost" size="sm" onClick={() => void refreshServer(server.id)}>
                <RotateCw className="h-4 w-4" aria-hidden="true" />
                刷新工具
              </Button>
            }
          />
        ))}
      </div>
    </PluginSection>
  );
}

interface PluginSectionProps {
  title: string;
  description: string;
  meta: string;
  loading: boolean;
  error: string | null;
  emptyTitle: string;
  empty: boolean;
  action?: ReactNode;
  children: ReactNode;
}

function PluginSection({
  title,
  description,
  meta,
  loading,
  error,
  emptyTitle,
  empty,
  action,
  children,
}: PluginSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-muted-foreground dark:bg-[#2a2c30]">
              {meta}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}
      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center">
          <Spinner />
        </div>
      ) : empty ? (
        <EmptyState description={`${emptyTitle}，请稍后刷新或先完成相关配置。`} />
      ) : (
        children
      )}
    </section>
  );
}

interface PluginCardProps {
  title: string;
  description: string;
  enabled: boolean;
  badge: string;
  tags?: string[];
  footer?: ReactNode;
  onEnabledChange: (enabled: boolean) => void;
}

function PluginCard({
  title,
  description,
  enabled,
  badge,
  tags = [],
  footer,
  onEnabledChange,
}: PluginCardProps) {
  return (
    <Card className="overflow-hidden border-slate-200 bg-white dark:border-[#2a2c30] dark:bg-[#202126]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{title}</h3>
            <p className="mt-2 line-clamp-2 min-h-10 text-sm text-muted-foreground">{description}</p>
          </div>
          <Switch
            checked={enabled}
            ariaLabel={`切换 ${title}`}
            onCheckedChange={onEnabledChange}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded border border-slate-200 px-2 py-0.5 text-xs text-muted-foreground dark:border-[#3b3d44]">
            {badge}
          </span>
          {enabled ? (
            <span className="rounded-full bg-pink-50 px-2 py-0.5 text-xs text-pink-500 dark:bg-pink-500/10">
              已启用
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-muted-foreground dark:bg-[#2a2c30]">
              未启用
            </span>
          )}
          {tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
        {footer ? <div className="mt-4 flex justify-end">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}

function McpActions() {
  return (
    <div className="hidden gap-2 md:flex">
      <Button variant="secondary" size="sm">导入配置</Button>
      <Button size="sm">添加服务器</Button>
    </div>
  );
}

function SkillActions() {
  return (
    <div className="hidden gap-2 md:flex">
      <Button variant="secondary" size="sm">安装</Button>
      <Button variant="secondary" size="sm">扫描</Button>
      <Button variant="secondary" size="sm">使用说明</Button>
    </div>
  );
}

function normalizeGlobalPlugins(response: GlobalPluginsResponse | unknown): CharacterPluginDefinition[] {
  const tools =
    response && typeof response === "object" && "tools" in response
      ? (response as GlobalPluginsResponse).tools
      : [];

  if (!Array.isArray(tools)) return [];

  return tools.filter((tool): tool is CharacterPluginDefinition => {
    return (
      typeof tool === "object" &&
      tool !== null &&
      "pluginId" in tool &&
      "displayName" in tool &&
      typeof (tool as { pluginId: unknown }).pluginId === "string"
    );
  });
}

function normalizeSkills(response: unknown): SkillItem[] {
  const items =
    response && typeof response === "object" && "items" in response
      ? (response as { items?: unknown }).items
      : response;

  if (!Array.isArray(items)) return [];

  return items
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      id: String(item.id ?? item.name ?? ""),
      name: String(item.name ?? item.id ?? "未命名 Skill"),
      description: typeof item.description === "string" ? item.description : undefined,
      enabled: typeof item.enabled === "boolean" ? item.enabled : true,
      version: typeof item.version === "string" ? item.version : undefined,
      builtIn: typeof item.builtIn === "boolean" ? item.builtIn : undefined,
      tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string") : [],
    }))
    .filter((skill) => skill.id.length > 0);
}

function isPluginTab(tab: string | undefined): tab is PluginTab {
  return tab === "local-tools" || tab === "skills" || tab === "mcp";
}

export default PluginsPage;
