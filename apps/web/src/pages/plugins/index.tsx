import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Code2,
  Download,
  ExternalLink,
  FileText,
  Dumbbell,
  Plus,
  RefreshCw,
  RotateCw,
  Trash2,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { mosaicApi, type ApiClient } from "@mosaic-dock/api-client";
import type { CharacterPluginDefinition, McpServer } from "@mosaic-dock/shared";
import { WorkspacePageHeader } from "../../components/layout/WorkspacePageHeader";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/empty-state";
import { Select } from "../../components/ui/select";
import { Spinner } from "../../components/ui/spinner";
import { Switch } from "../../components/ui/switch";
import { MarkdownContent } from "../../components/chat/MarkdownContent";
import { RoutePath } from "../../constants/routes";
import { cn } from "../../lib/utils";
import { skillMarketService, type MarketSkill, type SkillMarketService } from "./skill-market-service";

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

interface SkillDocumentationDialogState {
  skillName: string;
  content: string;
  loading: boolean;
  error: string | null;
}

interface SkillMetaItem {
  key: string;
  value: string;
}

type MarketSkillLocalStatus = "not_installed" | "installed" | "updatable";

interface MarketSkillWithStatus extends MarketSkill {
  localStatus: MarketSkillLocalStatus;
  localVersion?: string;
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
    | "reloadSkill"
    | "fetchSkillDocumentation"
    | "installSkill"
    | "installSkillFromUrl"
    | "installSkillFromRegistry"
    | "uninstallSkill"
    | "fetchMcpServers"
    | "createMcpServer"
    | "toggleMcpServer"
    | "refreshMcpServerTools"
  >;
  market?: SkillMarketService;
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
      <WorkspacePageHeader title="插件" />
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
  const [scanning, setScanning] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reloadingSkillIds, setReloadingSkillIds] = useState<Set<string>>(new Set());
  const [documentationDialog, setDocumentationDialog] = useState<SkillDocumentationDialogState | null>(null);
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [installFile, setInstallFile] = useState<File | null>(null);
  const [forceOverwrite, setForceOverwrite] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [uninstallTarget, setUninstallTarget] = useState<SkillItem | null>(null);
  const [uninstallingSkillId, setUninstallingSkillId] = useState<string | null>(null);
  const [uninstallError, setUninstallError] = useState<string | null>(null);
  const [marketSkills, setMarketSkills] = useState<MarketSkillWithStatus[]>([]);
  const [loadingMarket, setLoadingMarket] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [selectedMarketSkill, setSelectedMarketSkill] = useState<MarketSkillWithStatus | null>(null);
  const [installingFromMarketIds, setInstallingFromMarketIds] = useState<Set<string>>(new Set());
  const [marketInstallError, setMarketInstallError] = useState<string | null>(null);
  const [skillsShDialogOpen, setSkillsShDialogOpen] = useState(false);
  const [skillsShIdentifier, setSkillsShIdentifier] = useState("");
  const [skillsShForce, setSkillsShForce] = useState(false);
  const [installingFromSkillsSh, setInstallingFromSkillsSh] = useState(false);
  const [skillsShInstallError, setSkillsShInstallError] = useState<string | null>(null);
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [githubIdentifier, setGithubIdentifier] = useState("");
  const [githubForce, setGithubForce] = useState(false);
  const [installingFromGithub, setInstallingFromGithub] = useState(false);
  const [githubInstallError, setGithubInstallError] = useState<string | null>(null);
  const skillsRef = useRef<SkillItem[]>([]);
  const enabledCount = useMemo(() => skills.filter((skill) => skill.enabled !== false).length, [skills]);
  const market = api.market ?? skillMarketService;

  async function loadSkills() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.client.fetchSkills();
      const nextSkills = normalizeSkills(response);
      skillsRef.current = nextSkills;
      setSkills(nextSkills);
      setMarketSkills((current) => applyMarketSkillStatus(current, nextSkills));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Skills 加载失败");
      skillsRef.current = [];
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSkills();
  }, [api]);

  useEffect(() => {
    void loadMarketSkills();
  }, [api]);

  useEffect(() => {
    return () => {
      clearToastTimeout();
    };
  }, []);

  function updateScanning(nextScanning: boolean) {
    setScanning(nextScanning);
  }

  function clearToastTimeout() {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
  }

  function showToast(message: string) {
    clearToastTimeout();
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 3000);
  }

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
    if (scanning) return;
    updateScanning(true);
    clearToastTimeout();
    setToastMessage(null);
    try {
      await api.client.triggerSkillScan();
      await loadSkills();
      showToast("扫描完成");
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "刷新 Skills 失败");
    } finally {
      updateScanning(false);
    }
  }

  async function reloadSkill(skillId: string) {
    setReloadingSkillIds((current) => new Set(current).add(skillId));
    try {
      await api.client.reloadSkill(skillId);
      await loadSkills();
    } catch (reloadError) {
      setError(reloadError instanceof Error ? reloadError.message : "Skill 重载失败");
    } finally {
      setReloadingSkillIds((current) => {
        const next = new Set(current);
        next.delete(skillId);
        return next;
      });
    }
  }

  async function loadMarketSkills(forceRefresh = false) {
    if (loadingMarket) return;
    setLoadingMarket(true);
    setMarketError(null);
    const startedAt = Date.now();
    try {
      const remoteSkills = await market.fetchMarketSkills(!forceRefresh);
      if (forceRefresh) {
        const elapsed = Date.now() - startedAt;
        if (elapsed < 500) await new Promise((resolve) => setTimeout(resolve, 500 - elapsed));
      }
      setMarketSkills(applyMarketSkillStatus(remoteSkills, skillsRef.current));
    } catch (loadMarketError) {
      setMarketError(loadMarketError instanceof Error ? loadMarketError.message : "加载推荐技能失败");
      setMarketSkills([]);
    } finally {
      setLoadingMarket(false);
    }
  }

  async function openSkillDocumentation(skill: SkillItem) {
    setDocumentationDialog({ skillName: skill.name, content: "", loading: true, error: null });
    try {
      const response = await api.client.fetchSkillDocumentation(skill.id);
      setDocumentationDialog({
        skillName: skill.name,
        content: getStringValue((response as { content?: unknown }).content) ?? "暂无文档内容",
        loading: false,
        error: null,
      });
    } catch (docError) {
      setDocumentationDialog({
        skillName: skill.name,
        content: "",
        loading: false,
        error: docError instanceof Error ? docError.message : "获取文档失败",
      });
    }
  }

  function openInstallDialog() {
    setInstallDialogOpen(true);
    setInstallFile(null);
    setForceOverwrite(false);
    setInstallError(null);
  }

  function updateInstallFile(file: File | null) {
    if (!file) {
      setInstallFile(null);
      return;
    }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setInstallFile(null);
      setInstallError("请选择 ZIP 文件");
      return;
    }
    setInstallFile(file);
    setInstallError(null);
  }

  function closeInstallDialog() {
    if (installing) return;
    setInstallDialogOpen(false);
    setInstallFile(null);
    setForceOverwrite(false);
    setInstallError(null);
  }

  async function installSelectedSkill() {
    if (!installFile) return;
    setInstalling(true);
    setInstallError(null);
    try {
      const response = await api.client.installSkill(installFile, forceOverwrite);
      setInstallDialogOpen(false);
      setInstallFile(null);
      setForceOverwrite(false);
      await loadSkills();
      showToast(getStringValue((response as { message?: unknown }).message) ?? "安装成功");
    } catch (installSkillError) {
      setInstallError(installSkillError instanceof Error ? installSkillError.message : "安装失败");
    } finally {
      setInstalling(false);
    }
  }

  async function uninstallSelectedSkill() {
    if (!uninstallTarget) return;
    setUninstallingSkillId(uninstallTarget.id);
    setUninstallError(null);
    try {
      const response = await api.client.uninstallSkill(uninstallTarget.id);
      setUninstallTarget(null);
      await loadSkills();
      showToast(getStringValue((response as { message?: unknown }).message) ?? "卸载成功");
    } catch (uninstallError) {
      setUninstallError(uninstallError instanceof Error ? uninstallError.message : "Skill 卸载失败");
    } finally {
      setUninstallingSkillId(null);
    }
  }

  function openMarketInstallDialog(skill: MarketSkillWithStatus) {
    setSelectedMarketSkill(skill);
    setMarketInstallError(null);
  }

  function closeMarketInstallDialog() {
    if (selectedMarketSkill && installingFromMarketIds.has(selectedMarketSkill.id)) return;
    setSelectedMarketSkill(null);
    setMarketInstallError(null);
  }

  async function installSelectedMarketSkill() {
    if (!selectedMarketSkill) return;
    const zipUrl = getMarketInstallUrl(selectedMarketSkill, "zip");
    if (!zipUrl) {
      setMarketInstallError("该技能暂无 ZIP 安装包");
      return;
    }
    setInstallingFromMarketIds((current) => new Set(current).add(selectedMarketSkill.id));
    setMarketInstallError(null);
    try {
      const response = await api.client.installSkillFromUrl(zipUrl, false);
      setSelectedMarketSkill(null);
      await loadSkills();
      showToast(getStringValue((response as { message?: unknown }).message) ?? "安装成功");
    } catch (installMarketError) {
      setMarketInstallError(installMarketError instanceof Error ? installMarketError.message : "安装失败");
    } finally {
      setInstallingFromMarketIds((current) => {
        const next = new Set(current);
        if (selectedMarketSkill) next.delete(selectedMarketSkill.id);
        return next;
      });
    }
  }

  function openSkillsShDialog() {
    setSkillsShDialogOpen(true);
    setSkillsShIdentifier("");
    setSkillsShForce(false);
    setSkillsShInstallError(null);
  }

  function closeSkillsShDialog() {
    if (installingFromSkillsSh) return;
    setSkillsShDialogOpen(false);
    setSkillsShIdentifier("");
    setSkillsShForce(false);
    setSkillsShInstallError(null);
  }

  async function installFromSkillsSh() {
    const identifier = skillsShIdentifier.trim();
    if (!identifier) {
      setSkillsShInstallError("请输入 Skills.sh 标识");
      return;
    }
    setInstallingFromSkillsSh(true);
    setSkillsShInstallError(null);
    try {
      const response = await api.client.installSkillFromRegistry({
        source: "skills-sh",
        identifier,
        force: skillsShForce,
      });
      setSkillsShDialogOpen(false);
      setSkillsShIdentifier("");
      setSkillsShForce(false);
      await loadSkills();
      showToast(getStringValue((response as { message?: unknown }).message) ?? "安装成功");
    } catch (installError) {
      setSkillsShInstallError(installError instanceof Error ? installError.message : "安装失败");
    } finally {
      setInstallingFromSkillsSh(false);
    }
  }

  function openGithubDialog() {
    setGithubDialogOpen(true);
    setGithubIdentifier("");
    setGithubForce(false);
    setGithubInstallError(null);
  }

  function closeGithubDialog() {
    if (installingFromGithub) return;
    setGithubDialogOpen(false);
    setGithubIdentifier("");
    setGithubForce(false);
    setGithubInstallError(null);
  }

  async function installFromGithub() {
    const identifier = githubIdentifier.trim();
    if (!identifier) {
      setGithubInstallError("请输入 GitHub 仓库或路径");
      return;
    }
    setInstallingFromGithub(true);
    setGithubInstallError(null);
    try {
      const response = await api.client.installSkillFromRegistry({
        source: "github",
        identifier,
        force: githubForce,
      });
      setGithubDialogOpen(false);
      setGithubIdentifier("");
      setGithubForce(false);
      await loadSkills();
      showToast(getStringValue((response as { message?: unknown }).message) ?? "安装成功");
    } catch (installError) {
      setGithubInstallError(installError instanceof Error ? installError.message : "安装失败");
    } finally {
      setInstallingFromGithub(false);
    }
  }

  return (
    <>
      {toastMessage ? (
        <div
          role="status"
          className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-md bg-green-50 px-4 py-2 text-sm text-green-700 shadow-sm dark:bg-green-500/10 dark:text-green-300"
        >
          {toastMessage}
        </div>
      ) : null}
      <PluginSection
        title="Skills"
        description="Skills 是系统自动发现的本地技能模块，可为助手提供特定工作流、知识和执行规范。"
        meta={`${enabledCount}/${skills.length} 已启用`}
        loading={loading}
        error={error}
        emptyTitle="暂无 Skills"
        empty={skills.length === 0}
        action={
          <SkillActions
            scanning={scanning}
            onInstall={openInstallDialog}
            onInstallFromSkillsSh={openSkillsShDialog}
            onInstallFromGithub={openGithubDialog}
            onScan={() => void scanSkills()}
          />
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {skills.map((skill) => (
            <PluginCard
              key={skill.id}
              title={skill.name}
              description={skill.description || "暂无描述"}
              enabled={skill.enabled !== false}
              badge={skill.version || (skill.builtIn ? "内置" : "用户")}
              tags={skill.tags}
              footer={
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => void openSkillDocumentation(skill)}>
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    SKILL.md
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`重载 ${skill.name}`}
                    disabled={reloadingSkillIds.has(skill.id)}
                    onClick={() => void reloadSkill(skill.id)}
                  >
                    <RotateCw
                      className={cn("h-4 w-4", reloadingSkillIds.has(skill.id) ? "animate-spin" : "")}
                      aria-hidden="true"
                    />
                    重载
                  </Button>
                  {!skill.builtIn ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`卸载 ${skill.name}`}
                      className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                      disabled={uninstallingSkillId === skill.id}
                      onClick={() => {
                        setUninstallError(null);
                        setUninstallTarget(skill);
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      卸载
                    </Button>
                  ) : null}
                </div>
              }
              onEnabledChange={(enabled) => void toggleSkill(skill.id, enabled)}
            />
          ))}
        </div>
      </PluginSection>
      <MarketSkillsSection
        skills={marketSkills}
        loading={loadingMarket}
        error={marketError}
        installingIds={installingFromMarketIds}
        onRefresh={() => void loadMarketSkills(true)}
        onInstall={openMarketInstallDialog}
      />
      {documentationDialog ? (
        <SkillDocumentationDialog
          state={documentationDialog}
          onClose={() => setDocumentationDialog(null)}
        />
      ) : null}
      {installDialogOpen ? (
        <SkillInstallDialog
          file={installFile}
          forceOverwrite={forceOverwrite}
          installing={installing}
          error={installError}
          onFileChange={updateInstallFile}
          onForceOverwriteChange={setForceOverwrite}
          onClearFile={() => {
            setInstallFile(null);
            setForceOverwrite(false);
          }}
          onCancel={closeInstallDialog}
          onInstall={() => void installSelectedSkill()}
        />
      ) : null}
      {uninstallTarget ? (
        <SkillUninstallConfirmDialog
          skill={uninstallTarget}
          uninstalling={uninstallingSkillId === uninstallTarget.id}
          error={uninstallError}
          onCancel={() => {
            if (!uninstallingSkillId) {
              setUninstallTarget(null);
              setUninstallError(null);
            }
          }}
          onConfirm={() => void uninstallSelectedSkill()}
        />
      ) : null}
      {selectedMarketSkill ? (
        <MarketSkillInstallDialog
          skill={selectedMarketSkill}
          installing={installingFromMarketIds.has(selectedMarketSkill.id)}
          error={marketInstallError}
          onCancel={closeMarketInstallDialog}
          onInstall={() => void installSelectedMarketSkill()}
          onOpenGit={() => openExternalUrl(getMarketInstallUrl(selectedMarketSkill, "git"))}
          onOpenDetail={() => openExternalUrl(selectedMarketSkill.detailUrl)}
        />
      ) : null}
      {skillsShDialogOpen ? (
        <SkillsShInstallDialog
          identifier={skillsShIdentifier}
          force={skillsShForce}
          installing={installingFromSkillsSh}
          error={skillsShInstallError}
          onIdentifierChange={setSkillsShIdentifier}
          onForceChange={setSkillsShForce}
          onCancel={closeSkillsShDialog}
          onInstall={() => void installFromSkillsSh()}
        />
      ) : null}
      {githubDialogOpen ? (
        <GithubInstallDialog
          identifier={githubIdentifier}
          force={githubForce}
          installing={installingFromGithub}
          error={githubInstallError}
          onIdentifierChange={setGithubIdentifier}
          onForceChange={setGithubForce}
          onCancel={closeGithubDialog}
          onInstall={() => void installFromGithub()}
        />
      ) : null}
    </>
  );
}

function SkillDocumentationDialog({
  state,
  onClose,
}: {
  state: SkillDocumentationDialogState;
  onClose: () => void;
}) {
  const meta = parseSkillFrontmatter(state.content);
  const body = stripSkillFrontmatter(state.content);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 px-4 py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="skill-documentation-title"
        className="flex max-h-[90vh] w-[800px] max-w-[90vw] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-[#2e3035] dark:bg-[#202126]"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-[#2e3035]">
          <h2 id="skill-documentation-title" className="text-sm font-semibold">
            {state.skillName} - SKILL.md
          </h2>
          <button
            type="button"
            aria-label="关闭文档"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {state.loading ? (
            <div className="grid min-h-40 place-items-center py-12">
              <Spinner />
            </div>
          ) : state.error ? (
            <div className="py-12 text-center text-sm text-red-500">{state.error}</div>
          ) : (
            <>
              {meta.length > 0 ? (
                <div className="mb-6 overflow-hidden rounded-lg border border-slate-200 dark:border-[#34363c]">
                  <table className="w-full border-collapse text-sm">
                    <tbody>
                      {meta.map((item) => (
                        <tr key={item.key} className="border-b border-slate-100 last:border-b-0 dark:border-[#34363c]">
                          <td className="w-32 bg-slate-50 px-3 py-3 font-medium text-slate-700 dark:bg-[#2a2c30] dark:text-slate-200">
                            {item.key}
                          </td>
                          <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{item.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <MarkdownContent content={body} />
            </>
          )}
        </div>
        <footer className="flex justify-end border-t border-slate-100 px-4 py-3 dark:border-[#2e3035]">
          <Button variant="secondary" size="sm" onClick={onClose}>
            关闭
          </Button>
        </footer>
      </section>
    </div>
  );
}

function MarketSkillsSection({
  skills,
  loading,
  error,
  installingIds,
  onRefresh,
  onInstall,
}: {
  skills: MarketSkillWithStatus[];
  loading: boolean;
  error: string | null;
  installingIds: Set<string>;
  onRefresh: () => void;
  onInstall: (skill: MarketSkillWithStatus) => void;
}) {
  return (
    <section className="mt-8 space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">技能推荐</h2>
        <Button variant="ghost" size="sm" disabled={loading} onClick={onRefresh}>
          <RefreshCw className={cn("h-4 w-4", loading ? "animate-spin" : "")} aria-hidden="true" />
          {loading ? "加载中..." : "换一批"}
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-muted-foreground dark:border-[#232428] dark:bg-[#232428]">
          {error}
        </div>
      ) : skills.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {skills.map((skill) => (
            <Card
              key={skill.id}
              className="overflow-hidden border-slate-200 bg-white transition-colors hover:border-pink-300 dark:border-[#2a2c30] dark:bg-[#202126]"
            >
              <CardContent className="p-4">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">{skill.name}</h3>
                  <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-[#6b6d73]">{skill.id}</p>
                </div>
                <p className="mt-3 line-clamp-3 min-h-14 text-sm text-muted-foreground">
                  {skill.description || "暂无描述"}
                </p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    {(skill.labels ?? []).map((label) => (
                      <span key={label} className="rounded bg-pink-50 px-2 py-0.5 text-xs text-pink-500 dark:bg-pink-500/10">
                        {label}
                      </span>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`${getMarketButtonLabel(skill)} ${skill.name}`}
                    disabled={installingIds.has(skill.id)}
                    onClick={() => onInstall(skill)}
                  >
                    {installingIds.has(skill.id) ? "安装中..." : getMarketButtonLabel(skill)}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="pt-2 text-center text-sm text-muted-foreground">
        访问
        <a
          href="https://ai.dingd.cn/skills"
          target="_blank"
          rel="noreferrer"
          className="text-blue-500 hover:underline"
        >
          技能市场
        </a>
        获取更多推荐技能
      </div>
    </section>
  );
}

function MarketSkillInstallDialog({
  skill,
  installing,
  error,
  onCancel,
  onInstall,
  onOpenGit,
  onOpenDetail,
}: {
  skill: MarketSkillWithStatus;
  installing: boolean;
  error: string | null;
  onCancel: () => void;
  onInstall: () => void;
  onOpenGit: () => void;
  onOpenDetail: () => void;
}) {
  const zipUrl = getMarketInstallUrl(skill, "zip");
  const gitUrl = getMarketInstallUrl(skill, "git");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 px-4 py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="market-skill-install-title"
        className="w-[420px] max-w-[90vw] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-[#2e3035] dark:bg-[#202126]"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-[#2e3035]">
          <h2 id="market-skill-install-title" className="text-sm font-semibold">
            安装技能
          </h2>
          <button
            type="button"
            aria-label="关闭市场安装弹窗"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]"
            disabled={installing}
            onClick={onCancel}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        <div className="space-y-4 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold">{skill.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{skill.description || "暂无描述"}</p>
          </div>
          <div className="flex flex-col gap-3">
            {zipUrl ? (
              <Button size="lg" disabled={installing} onClick={onInstall}>
                {installing ? <Spinner /> : <Download className="h-4 w-4" aria-hidden="true" />}
                {getMarketButtonLabel(skill)}
              </Button>
            ) : null}
            {gitUrl ? (
              <Button variant="secondary" size="lg" onClick={onOpenGit}>
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                访问仓库
              </Button>
            ) : null}
            {skill.detailUrl ? (
              <Button variant="secondary" size="lg" onClick={onOpenDetail}>
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                查看详情
              </Button>
            ) : null}
          </div>
          {error ? <div className="text-sm text-red-500">{error}</div> : null}
        </div>
        <footer className="flex justify-end border-t border-slate-100 px-4 py-3 dark:border-[#2e3035]">
          <Button variant="secondary" size="sm" disabled={installing} onClick={onCancel}>
            取消
          </Button>
        </footer>
      </section>
    </div>
  );
}

function SkillsShInstallDialog({
  identifier,
  force,
  installing,
  error,
  onIdentifierChange,
  onForceChange,
  onCancel,
  onInstall,
}: {
  identifier: string;
  force: boolean;
  installing: boolean;
  error: string | null;
  onIdentifierChange: (value: string) => void;
  onForceChange: (checked: boolean) => void;
  onCancel: () => void;
  onInstall: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 px-4 py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="skills-sh-install-title"
        className="w-[500px] max-w-[90vw] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-[#2e3035] dark:bg-[#202126]"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-[#2e3035]">
          <h2 id="skills-sh-install-title" className="text-sm font-semibold">
            从 Skills.sh 安装
          </h2>
          <button
            type="button"
            aria-label="关闭 Skills.sh 安装弹窗"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]"
            disabled={installing}
            onClick={onCancel}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-muted-foreground">
            输入 skills.sh 的 GitHub 标识，例如 <code>anthropics/skills/skill-creator</code>。
          </p>
          <label className="block space-y-2 text-sm">
            <span>Skills.sh 标识</span>
            <input
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/20 dark:border-[#34363c] dark:bg-[#1e1f23]"
              value={identifier}
              disabled={installing}
              placeholder="owner/repo 或 owner/repo/path/to/skill"
              onChange={(event) => onIdentifierChange(event.currentTarget.value)}
            />
          </label>
          <div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 accent-pink-500"
                checked={force}
                disabled={installing}
                onChange={(event) => onForceChange(event.currentTarget.checked)}
              />
              强制覆盖（如果技能已存在则替换）
            </label>
            <div className="ml-6 mt-1 text-xs text-muted-foreground">
              将从 GitHub archive 下载并安装，服务端不会执行外部 CLI 命令。
            </div>
          </div>
          {error ? <div className="text-sm text-red-500">{error}</div> : null}
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-[#2e3035]">
          <Button variant="secondary" size="sm" disabled={installing} onClick={onCancel}>
            取消
          </Button>
          <Button size="sm" disabled={!identifier.trim() || installing} onClick={onInstall}>
            {installing ? <Spinner /> : null}
            安装
          </Button>
        </footer>
      </section>
    </div>
  );
}

function GithubInstallDialog({
  identifier,
  force,
  installing,
  error,
  onIdentifierChange,
  onForceChange,
  onCancel,
  onInstall,
}: {
  identifier: string;
  force: boolean;
  installing: boolean;
  error: string | null;
  onIdentifierChange: (value: string) => void;
  onForceChange: (checked: boolean) => void;
  onCancel: () => void;
  onInstall: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 px-4 py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="github-install-title"
        className="w-[500px] max-w-[90vw] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-[#2e3035] dark:bg-[#202126]"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-[#2e3035]">
          <h2 id="github-install-title" className="text-sm font-semibold">
            从 GitHub 安装
          </h2>
          <button
            type="button"
            aria-label="关闭 GitHub 安装弹窗"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]"
            disabled={installing}
            onClick={onCancel}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-muted-foreground">
            输入 GitHub 仓库或子目录，例如 <code>https://github.com/acme/skills/tree/main/frontend-design</code>。
          </p>
          <label className="block space-y-2 text-sm">
            <span>GitHub 仓库或路径</span>
            <input
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/20 dark:border-[#34363c] dark:bg-[#1e1f23]"
              value={identifier}
              disabled={installing}
              placeholder="owner/repo 或 GitHub URL"
              onChange={(event) => onIdentifierChange(event.currentTarget.value)}
            />
          </label>
          <div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 accent-pink-500"
                checked={force}
                disabled={installing}
                onChange={(event) => onForceChange(event.currentTarget.checked)}
              />
              强制覆盖（如果技能已存在则替换）
            </label>
            <div className="ml-6 mt-1 text-xs text-muted-foreground">
              将从 GitHub archive 下载并安装，服务端不会执行外部 CLI 命令。
            </div>
          </div>
          {error ? <div className="text-sm text-red-500">{error}</div> : null}
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-[#2e3035]">
          <Button variant="secondary" size="sm" disabled={installing} onClick={onCancel}>
            取消
          </Button>
          <Button size="sm" disabled={!identifier.trim() || installing} onClick={onInstall}>
            {installing ? <Spinner /> : null}
            安装
          </Button>
        </footer>
      </section>
    </div>
  );
}

function SkillInstallDialog({
  file,
  forceOverwrite,
  installing,
  error,
  onFileChange,
  onForceOverwriteChange,
  onClearFile,
  onCancel,
  onInstall,
}: {
  file: File | null;
  forceOverwrite: boolean;
  installing: boolean;
  error: string | null;
  onFileChange: (file: File | null) => void;
  onForceOverwriteChange: (checked: boolean) => void;
  onClearFile: () => void;
  onCancel: () => void;
  onInstall: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 px-4 py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="skill-install-title"
        className="flex w-[500px] max-w-[90vw] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-[#2e3035] dark:bg-[#202126]"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-[#2e3035]">
          <h2 id="skill-install-title" className="text-sm font-semibold">
            安装 Skill
          </h2>
          <button
            type="button"
            aria-label="关闭安装弹窗"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]"
            disabled={installing}
            onClick={onCancel}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-slate-600 dark:text-[#8b8d95]">
            请上传 ZIP 格式的 Skill 包。ZIP 文件应包含一个 Skill 目录，其中必须有 SKILL.md 文件。
          </p>
          <label
            className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-200 bg-white px-4 py-8 text-center transition-colors hover:border-pink-300 hover:bg-pink-50/30 dark:border-[#34363c] dark:bg-[#1e1f23] dark:hover:bg-pink-500/5"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (installing) return;
              onFileChange(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            <Upload className="h-10 w-10 text-slate-400" aria-hidden="true" />
            <span className="text-sm text-muted-foreground">
              拖拽文件到此处或 <span className="text-pink-500">点击上传</span>
            </span>
            <input
              key={file?.name ?? "empty"}
              type="file"
              accept=".zip"
              aria-label="上传 Skill ZIP 文件"
              className="sr-only"
              disabled={installing}
              onChange={(event) => onFileChange(event.currentTarget.files?.[0] ?? null)}
            />
          </label>
          <p className="text-xs text-muted-foreground">仅支持 .zip 格式文件</p>

          {file ? (
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-[#2a2c30]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate text-sm">{file.name}</span>
                </div>
                <button
                  type="button"
                  aria-label="清除已选 Skill 文件"
                  className="rounded p-1 text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
                  disabled={installing}
                  onClick={onClearFile}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                大小: <span>{formatFileSize(file.size)}</span>
              </div>
            </div>
          ) : null}

          <div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 accent-pink-500"
                checked={forceOverwrite}
                disabled={installing}
                onChange={(event) => onForceOverwriteChange(event.currentTarget.checked)}
              />
              强制覆盖（如果技能已存在则替换）
            </label>
            <div className="ml-6 mt-1 text-xs text-muted-foreground">
              注意：此操作会删除旧版本的技能文件
            </div>
          </div>

          {error ? <div className="text-sm text-red-500">{error}</div> : null}
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-[#2e3035]">
          <Button variant="secondary" size="sm" disabled={installing} onClick={onCancel}>
            取消
          </Button>
          <Button size="sm" disabled={!file || installing} onClick={onInstall}>
            {installing ? <Spinner /> : null}
            安装
          </Button>
        </footer>
      </section>
    </div>
  );
}

function SkillUninstallConfirmDialog({
  skill,
  uninstalling,
  error,
  onCancel,
  onConfirm,
}: {
  skill: SkillItem;
  uninstalling: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-white/75 px-4 py-6 backdrop-blur-[1px] dark:bg-black/50">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="skill-uninstall-title"
        className="w-[420px] max-w-[90vw] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-[#2e3035] dark:bg-[#202126]"
      >
        <header className="flex items-center justify-between px-5 py-4">
          <h2 id="skill-uninstall-title" className="text-sm font-semibold">
            确认卸载
          </h2>
          <button
            type="button"
            aria-label="关闭卸载确认"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]"
            disabled={uninstalling}
            onClick={onCancel}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        <div className="flex gap-3 px-5 pb-5">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          </div>
          <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
            {`确定要卸载 Skill "${skill.name}" 吗？此操作将删除该 Skill 的所有文件。`}
          </p>
        </div>
        {error ? <div className="mx-5 mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}
        <footer className="flex justify-end gap-2 px-5 pb-4">
          <Button variant="secondary" size="sm" disabled={uninstalling} onClick={onCancel}>
            取消
          </Button>
          <Button
            size="sm"
            disabled={uninstalling}
            className="bg-pink-500 text-white hover:bg-pink-600"
            onClick={onConfirm}
          >
            {uninstalling ? <Spinner /> : null}
            确定
          </Button>
        </footer>
      </section>
    </div>
  );
}

function McpServersPanel({ api }: { api: PluginsPageApi }) {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [serverForm, setServerForm] = useState<McpServerFormState>(createEmptyMcpServerForm());
  const [savingServer, setSavingServer] = useState(false);
  const [serverFormError, setServerFormError] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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

  function openImportDialog() {
    setImportJsonText("");
    setImportError(null);
    setImportDialogOpen(true);
  }

  function closeImportDialog() {
    if (importing) return;
    setImportDialogOpen(false);
    setImportJsonText("");
    setImportError(null);
  }

  async function importMcpServers() {
    setImporting(true);
    setImportError(null);
    setNotice(null);
    try {
      const serversToImport = parseMcpImportConfig(importJsonText);
      let successCount = 0;
      const errors: string[] = [];

      for (const server of serversToImport) {
        try {
          await api.client.createMcpServer(server);
          successCount += 1;
        } catch (createError) {
          errors.push(`"${String(server.name || "unknown")}": ${createError instanceof Error ? createError.message : "导入失败"}`);
        }
      }

      if (successCount > 0) {
        setNotice(`成功导入 ${successCount} 个服务器`);
        await loadServers();
        setImportDialogOpen(false);
        setImportJsonText("");
      }
      if (errors.length > 0) {
        setImportError(`导入失败：${errors.length} 个\n${errors.join("\n")}`);
      }
      if (successCount === 0 && errors.length === 0) {
        setImportError("未找到可导入的服务器配置");
      }
    } catch (importConfigError) {
      setImportError(importConfigError instanceof SyntaxError
        ? "JSON 格式错误，请检查输入"
        : importConfigError instanceof Error
          ? importConfigError.message
          : "导入失败");
    } finally {
      setImporting(false);
    }
  }

  function openAddDialog() {
    setServerForm(createEmptyMcpServerForm());
    setServerFormError(null);
    setAddDialogOpen(true);
  }

  function closeAddDialog() {
    if (savingServer) return;
    setAddDialogOpen(false);
    setServerForm(createEmptyMcpServerForm());
    setServerFormError(null);
  }

  function updateServerForm(patch: Partial<McpServerFormState>) {
    setServerForm((current) => ({ ...current, ...patch }));
    setServerFormError(null);
  }

  async function saveMcpServer() {
    setSavingServer(true);
    setServerFormError(null);
    setNotice(null);
    try {
      const submitData = buildMcpServerSubmitData(serverForm);
      await api.client.createMcpServer(submitData);
      setNotice("添加成功");
      setAddDialogOpen(false);
      setServerForm(createEmptyMcpServerForm());
      await loadServers();
    } catch (saveError) {
      setServerFormError(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setSavingServer(false);
    }
  }

  return (
    <>
      {notice ? (
        <div
          role="status"
          className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-md bg-green-50 px-4 py-2 text-sm text-green-700 shadow-sm dark:bg-green-500/10 dark:text-green-300"
        >
          {notice}
        </div>
      ) : null}
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
            <Button variant="secondary" size="sm" onClick={openImportDialog}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              导入配置
            </Button>
            <Button size="sm" onClick={openAddDialog}>
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
      {importDialogOpen ? (
        <McpImportDialog
          jsonText={importJsonText}
          importing={importing}
          error={importError}
          onJsonTextChange={setImportJsonText}
          onCancel={closeImportDialog}
          onImport={() => void importMcpServers()}
        />
      ) : null}
      {addDialogOpen ? (
        <McpServerDialog
          form={serverForm}
          saving={savingServer}
          error={serverFormError}
          onChange={updateServerForm}
          onCancel={closeAddDialog}
          onSave={() => void saveMcpServer()}
        />
      ) : null}
    </>
  );
}

function McpImportDialog({
  jsonText,
  importing,
  error,
  onJsonTextChange,
  onCancel,
  onImport,
}: {
  jsonText: string;
  importing: boolean;
  error: string | null;
  onJsonTextChange: (value: string) => void;
  onCancel: () => void;
  onImport: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 px-4 py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mcp-import-title"
        className="flex w-[640px] max-w-[90vw] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-[#2e3035] dark:bg-[#202126]"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#2e3035]">
          <h2 id="mcp-import-title" className="text-sm font-semibold">
            导入 MCP 服务器配置
          </h2>
          <button
            type="button"
            aria-label="关闭导入配置弹窗"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]"
            disabled={importing}
            onClick={onCancel}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <div className="mb-2 text-sm text-muted-foreground">
              请粘贴 MCP 服务器配置 JSON 数据，支持以下格式：
            </div>
            <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
              <li>
                标准格式：
                <code className="rounded bg-slate-100 px-1 dark:bg-[#2a2c30]">{"{\"mcpServers\": {...}}"}</code>
              </li>
              <li>
                单个服务器对象格式：
                <code className="rounded bg-slate-100 px-1 dark:bg-[#2a2c30]">{"{\"name\": \"...\", \"baseUrl\": \"...\"}"}</code>
              </li>
            </ul>
          </div>
          <textarea
            className="min-h-[260px] w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/20 dark:border-[#34363c] dark:bg-[#1e1f23]"
            value={jsonText}
            disabled={importing}
            placeholder={`请粘贴 JSON 配置，例如：
{
  "mcpServers": {
    "WebSearch": {
      "type": "streamableHttp",
      "description": "描述信息",
      "isActive": true,
      "name": "阿里云百炼_联网搜索",
      "baseUrl": "https://dashscope.aliyuncs.com/api/v1/mcps/WebSearch/mcp",
      "headers": {
        "Authorization": "Bearer sk-xxx"
      }
    }
  }
}`}
            onChange={(event) => onJsonTextChange(event.currentTarget.value)}
          />
          {error ? <div className="whitespace-pre-line text-sm text-red-500">{error}</div> : null}
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-[#2e3035]">
          <Button variant="secondary" size="sm" disabled={importing} onClick={onCancel}>
            取消
          </Button>
          <Button size="sm" disabled={importing} className="bg-pink-500 text-white hover:bg-pink-600" onClick={onImport}>
            {importing ? <Spinner /> : null}
            导入
          </Button>
        </footer>
      </section>
    </div>
  );
}

type McpServerProtocol = "stdio" | "sse" | "streamableHttp";

const mcpProtocolOptions = [
  { value: "stdio", label: "标准输入 / 输出 (stdio)" },
  { value: "sse", label: "服务器发送事件 (sse)" },
  { value: "streamableHttp", label: "可流式传输的 HTTP (streamableHttp)" },
];

interface McpServerFormState {
  name: string;
  url: string;
  type: McpServerProtocol;
  description: string;
  headers: string;
  command: string;
  args: string;
  env: string;
  cwd: string;
  enabled: boolean;
}

function McpServerDialog({
  form,
  saving,
  error,
  onChange,
  onCancel,
  onSave,
}: {
  form: McpServerFormState;
  saving: boolean;
  error: string | null;
  onChange: (patch: Partial<McpServerFormState>) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const isStdio = form.type === "stdio";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 px-4 py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mcp-server-dialog-title"
        className="flex w-[560px] max-w-[90vw] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-[#2e3035] dark:bg-[#202126]"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#2e3035]">
          <h2 id="mcp-server-dialog-title" className="text-sm font-semibold">
            添加 MCP 服务器
          </h2>
          <button
            type="button"
            aria-label="关闭添加 MCP 服务器弹窗"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]"
            disabled={saving}
            onClick={onCancel}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-4">
          <McpFormRow label="服务器名称" required>
            <input
              aria-label="服务器名称"
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/20 dark:border-[#34363c] dark:bg-[#1e1f23]"
              value={form.name}
              disabled={saving}
              placeholder="请输入服务器名称"
              onChange={(event) => onChange({ name: event.currentTarget.value })}
            />
          </McpFormRow>

          {!isStdio ? (
            <>
              <McpFormRow label="服务地址" required>
                <input
                  aria-label="服务地址"
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/20 dark:border-[#34363c] dark:bg-[#1e1f23]"
                  value={form.url}
                  disabled={saving}
                  placeholder="https://example.com/mcp"
                  onChange={(event) => onChange({ url: event.currentTarget.value })}
                />
              </McpFormRow>
              <McpFormRow label="HTTP 请求头">
                <textarea
                  aria-label="HTTP 请求头"
                  className="min-h-[112px] w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/20 dark:border-[#34363c] dark:bg-[#1e1f23]"
                  value={form.headers}
                  disabled={saving}
                  placeholder={"请输入自定义 HTTP 请求头，一行一个，格式：Header-Name: value\n例如：\nAuthorization: Bearer your_token\nX-API-Key: your_api_key"}
                  onChange={(event) => onChange({ headers: event.currentTarget.value })}
                />
                <div className="mt-1 text-xs text-muted-foreground">
                  每行一个请求头，格式为 &quot;Header-Name: value&quot;
                </div>
              </McpFormRow>
            </>
          ) : (
            <>
              <McpFormRow label="命令" required>
                <input
                  aria-label="命令"
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/20 dark:border-[#34363c] dark:bg-[#1e1f23]"
                  value={form.command}
                  disabled={saving}
                  placeholder="例如: npx, python, node"
                  onChange={(event) => onChange({ command: event.currentTarget.value })}
                />
                <div className="mt-1 text-xs text-muted-foreground">要执行的命令或可执行文件</div>
              </McpFormRow>
              <McpFormRow label="参数">
                <textarea
                  aria-label="参数"
                  className="min-h-[80px] w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/20 dark:border-[#34363c] dark:bg-[#1e1f23]"
                  value={form.args}
                  disabled={saving}
                  placeholder={"每行一个参数，例如:\n-m\nmcp_server\n--port\n3000"}
                  onChange={(event) => onChange({ args: event.currentTarget.value })}
                />
                <div className="mt-1 text-xs text-muted-foreground">每行一个参数</div>
              </McpFormRow>
              <McpFormRow label="环境变量">
                <textarea
                  aria-label="环境变量"
                  className="min-h-[112px] w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/20 dark:border-[#34363c] dark:bg-[#1e1f23]"
                  value={form.env}
                  disabled={saving}
                  placeholder={"请输入环境变量，一行一个，格式：KEY=value\n例如:\nAPI_KEY=your_api_key\nNODE_ENV=production"}
                  onChange={(event) => onChange({ env: event.currentTarget.value })}
                />
                <div className="mt-1 text-xs text-muted-foreground">每行一个环境变量，格式为 &quot;KEY=value&quot;</div>
              </McpFormRow>
              <McpFormRow label="工作目录">
                <input
                  aria-label="工作目录"
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/20 dark:border-[#34363c] dark:bg-[#1e1f23]"
                  value={form.cwd}
                  disabled={saving}
                  placeholder="可选，例如: /path/to/working/dir"
                  onChange={(event) => onChange({ cwd: event.currentTarget.value })}
                />
              </McpFormRow>
            </>
          )}

          <McpFormRow label="协议类型" required>
            <Select
              value={form.type}
              disabled={saving}
              ariaLabel="协议类型"
              options={mcpProtocolOptions}
              onValueChange={(value) => onChange({ type: value as McpServerProtocol })}
            />
          </McpFormRow>

          <McpFormRow label="描述信息">
            <textarea
              aria-label="描述信息"
              className="min-h-[80px] w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/20 dark:border-[#34363c] dark:bg-[#1e1f23]"
              value={form.description}
              disabled={saving}
              placeholder="可选，描述此服务器的用途"
              onChange={(event) => onChange({ description: event.currentTarget.value })}
            />
          </McpFormRow>

          <div className="grid grid-cols-[96px_1fr] items-center gap-4">
            <span className="text-sm text-muted-foreground">启用状态</span>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.enabled}
                disabled={saving}
                ariaLabel="启用状态"
                onCheckedChange={(enabled) => onChange({ enabled })}
              />
              <span className="text-xs text-muted-foreground">{form.enabled ? "启动" : "禁用"}</span>
            </div>
          </div>

          {error ? <div className="whitespace-pre-line text-sm text-red-500">{error}</div> : null}
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-[#2e3035]">
          <Button variant="secondary" size="sm" disabled={saving} onClick={onCancel}>
            取消
          </Button>
          <Button size="sm" disabled={saving} className="bg-pink-500 text-white hover:bg-pink-600" onClick={onSave}>
            {saving ? <Spinner /> : null}
            确定
          </Button>
        </footer>
      </section>
    </div>
  );
}

function McpFormRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-start gap-4">
      <span className="pt-2 text-sm text-muted-foreground">
        {required ? <span className="text-pink-500">* </span> : null}
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}

function createEmptyMcpServerForm(): McpServerFormState {
  return {
    name: "",
    url: "",
    type: "streamableHttp",
    description: "",
    headers: "",
    command: "",
    args: "",
    env: "",
    cwd: "",
    enabled: true,
  };
}

function buildMcpServerSubmitData(form: McpServerFormState): Record<string, unknown> {
  const name = form.name.trim();
  if (!name) throw new Error("请输入服务器名称");

  if (form.type === "stdio") {
    const command = form.command.trim();
    if (!command) throw new Error("请输入命令");
    return {
      name,
      url: null,
      type: form.type,
      description: form.description.trim(),
      headers: null,
      command,
      args: parseLines(form.args),
      env: parseEnvLines(form.env),
      cwd: form.cwd.trim() || null,
      enabled: form.enabled,
    };
  }

  const url = form.url.trim();
  if (!url) throw new Error("请输入服务地址");
  return {
    name,
    url,
    type: form.type,
    description: form.description.trim(),
    headers: parseHeaderLines(form.headers),
    command: null,
    args: null,
    env: null,
    cwd: null,
    enabled: form.enabled,
  };
}

function parseHeaderLines(text: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    const colonIndex = trimmedLine.indexOf(":");
    if (colonIndex === -1) continue;
    const key = trimmedLine.slice(0, colonIndex).trim();
    const value = trimmedLine.slice(colonIndex + 1).trim();
    if (key && value) headers[key] = value;
  }
  return headers;
}

function parseEnvLines(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    const equalIndex = trimmedLine.indexOf("=");
    if (equalIndex === -1) continue;
    const key = trimmedLine.slice(0, equalIndex).trim();
    const value = trimmedLine.slice(equalIndex + 1).trim();
    if (key) env[key] = value;
  }
  return env;
}

function parseLines(text: string): string[] {
  return text.split("\n").map((line) => line.trim()).filter(Boolean);
}

function parseMcpImportConfig(jsonText: string): Array<Record<string, unknown>> {
  const jsonData = JSON.parse(jsonText) as unknown;
  if (!isPlainObject(jsonData)) {
    throw new Error("无效的 JSON 格式");
  }

  let serversToImport: Array<Record<string, unknown>>;
  const mcpServers = jsonData.mcpServers;
  if (isPlainObject(mcpServers)) {
    serversToImport = Object.entries(mcpServers)
      .filter(([, server]) => isPlainObject(server))
      .map(([key, server]) => ({ key, ...(server as Record<string, unknown>) }));
  } else if (typeof jsonData.name === "string" && typeof jsonData.baseUrl === "string") {
    serversToImport = [jsonData];
  } else {
    throw new Error("无法识别的 JSON 格式，请确保包含 mcpServers 字段或有效的服务器对象");
  }

  if (serversToImport.length === 0) {
    throw new Error("未找到可导入的服务器配置");
  }

  return serversToImport.map((serverData) => {
    const name = getStringValue(serverData.name) ?? getStringValue(serverData.key) ?? "未命名服务器";
    const url = getStringValue(serverData.baseUrl) ?? getStringValue(serverData.url) ?? "";
    if (!name || !url) {
      throw new Error("缺少必填字段：name 或 url");
    }

    return {
      name,
      url,
      description: getStringValue(serverData.description) ?? `导入自配置文件：${getStringValue(serverData.key) ?? "unknown"}`,
      headers: isPlainObject(serverData.headers) ? serverData.headers : {},
      enabled: typeof serverData.isActive === "boolean" ? serverData.isActive : true,
      type: getStringValue(serverData.type) ?? undefined,
    };
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function SkillActions({
  scanning,
  onInstall,
  onInstallFromSkillsSh,
  onInstallFromGithub,
  onScan,
}: {
  scanning: boolean;
  onInstall: () => void;
  onInstallFromSkillsSh: () => void;
  onInstallFromGithub: () => void;
  onScan: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" onClick={onInstall}>安装</Button>
      <Button variant="secondary" size="sm" onClick={onInstallFromSkillsSh}>从 Skills.sh 安装</Button>
      <Button variant="secondary" size="sm" onClick={onInstallFromGithub}>从 GitHub 安装</Button>
      <Button variant="secondary" size="sm" disabled={scanning} onClick={onScan}>
        <RefreshCw className={cn("h-4 w-4", scanning ? "animate-spin" : "")} aria-hidden="true" />
        扫描
      </Button>
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
    .map((item) => {
      const manifest = getSkillManifest(item);

      return {
        id: String(item.id ?? item.name ?? manifest?.name ?? ""),
        name: String(manifest?.name ?? item.name ?? item.id ?? "未命名 Skill"),
        description: getStringValue(manifest?.description) ?? getStringValue(item.description),
        enabled: typeof item.enabled === "boolean" ? item.enabled : true,
        version: getStringValue(manifest?.version) ?? getStringValue(item.version),
        builtIn: typeof item.builtIn === "boolean" ? item.builtIn : item.source === "system",
        tags: normalizeTags(manifest?.tags ?? item.tags),
      };
    })
    .filter((skill) => skill.id.length > 0);
}

function applyMarketSkillStatus(marketSkills: MarketSkill[], localSkills: SkillItem[]): MarketSkillWithStatus[] {
  return marketSkills.map((marketSkill) => {
    const localSkill = localSkills.find(
      (skill) => skill.name.toLowerCase() === marketSkill.id.toLowerCase(),
    );
    if (!localSkill) return { ...marketSkill, localStatus: "not_installed" };

    if (marketSkill.version && localSkill.version && marketSkill.version !== localSkill.version) {
      return {
        ...marketSkill,
        localStatus: "updatable",
        localVersion: localSkill.version,
      };
    }

    return {
      ...marketSkill,
      localStatus: "installed",
      localVersion: localSkill.version,
    };
  });
}

function getMarketInstallUrl(skill: MarketSkill, type: "zip" | "git"): string | undefined {
  return skill.installUrls?.find((item) => item.type === type)?.url;
}

function getMarketButtonLabel(skill: MarketSkillWithStatus): string {
  if (skill.localStatus === "updatable") return "升级";
  if (skill.localStatus === "installed") return "重新安装";
  return "安装";
}

function openExternalUrl(url: string | undefined) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function parseSkillFrontmatter(content: string): SkillMetaItem[] {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) return [];

  const lines = match[1].split("\n");
  const result: SkillMetaItem[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      index += 1;
      continue;
    }

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) {
      index += 1;
      continue;
    }

    const key = trimmed.slice(0, colonIndex).trim();
    let value = trimmed.slice(colonIndex + 1).trim();

    if (value === ">" || value === "|" || value === ">-" || value === "|-") {
      const multilineValues: string[] = [];
      index += 1;
      while (index < lines.length) {
        const nextLine = lines[index];
        if (/^\s+/.test(nextLine)) {
          multilineValues.push(nextLine.trim());
          index += 1;
        } else if (nextLine.trim() === "") {
          multilineValues.push("");
          index += 1;
        } else {
          break;
        }
      }
      while (multilineValues[multilineValues.length - 1] === "") {
        multilineValues.pop();
      }
      if (key && multilineValues.length > 0) {
        result.push({ key, value: multilineValues.join(" ") });
      }
      continue;
    }

    if (value === "" && trimmed.endsWith(":")) {
      const arrayItems: string[] = [];
      index += 1;
      while (index < lines.length) {
        const nextLine = lines[index];
        if (/^\s+-\s+/.test(nextLine)) {
          const item = nextLine.replace(/^\s+-\s*/, "").trim();
          if (item) arrayItems.push(stripYamlQuotes(item));
          index += 1;
        } else if (nextLine.trim() && !/^\s+/.test(nextLine)) {
          break;
        } else {
          index += 1;
        }
      }
      if (key && arrayItems.length > 0) {
        result.push({ key, value: arrayItems.join(", ") });
      }
      continue;
    }

    value = stripYamlQuotes(value);
    if (key && value) {
      result.push({ key, value });
    }
    index += 1;
  }

  return result;
}

function stripSkillFrontmatter(content: string): string {
  const match = content.match(/^---\s*\n[\s\S]*?\n---\s*\n([\s\S]*)$/);
  return (match ? match[1] : content).trim();
}

function stripYamlQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const unit = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(unit));
  return `${Math.round((bytes / Math.pow(unit, index)) * 100) / 100} ${sizes[index]}`;
}

function getSkillManifest(item: Record<string, unknown>): Record<string, unknown> | undefined {
  return typeof item.manifest === "object" && item.manifest !== null
    ? (item.manifest as Record<string, unknown>)
    : undefined;
}

function getStringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function normalizeTags(tags: unknown): string[] {
  return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [];
}

function isPluginTab(tab: string | undefined): tab is PluginTab {
  return tab === "local-tools" || tab === "skills" || tab === "mcp";
}

export default PluginsPage;
