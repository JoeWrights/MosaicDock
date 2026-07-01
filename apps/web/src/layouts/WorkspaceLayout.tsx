import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  AlarmClock,
  Bot,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Cloud,
  Edit2,
  Folder,
  MoreHorizontal,
  Moon,
  PlusSquare,
  Puzzle,
  Settings,
  Sun,
  Trash2,
  UserRound,
} from "lucide-react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { mosaicApi, type ApiClient } from "@mosaic-dock/api-client";
import type { Session } from "@mosaic-dock/shared";
import {
  SessionGroupManageDialog,
  type SessionGroup,
  type SessionGroupManageApi,
} from "../components/session/SessionGroupManageDialog";
import { RoutePath } from "../constants/routes";
import { useTheme } from "../hooks/useTheme";
import { cn } from "../lib/utils";

const navigation = [
  { key: "new-session", label: "新建任务", icon: PlusSquare, path: `${RoutePath.CHAT}/new-session` },
  { key: "characters", label: "助手", icon: UserRound, path: RoutePath.CHARACTERS_ASSISTANTS },
  { key: "bots", label: "机器人", icon: Bot, path: RoutePath.BOTS_MANAGEMENT },
  { key: "knowledge-base", label: "知识库", icon: BookOpen, path: RoutePath.KNOWLEDGE_BASE },
  { key: "plugins", label: "插件市场", icon: Puzzle, path: RoutePath.PLUGINS_LOCAL_TOOLS },
  { key: "scheduler", label: "定时任务", icon: AlarmClock, path: RoutePath.SCHEDULER },
  { key: "models", label: "模型管理", icon: Cloud, path: RoutePath.MODELS },
];

interface WorkspaceLayoutApi {
  client: Pick<
    ApiClient,
    | "fetchSessions"
    | "fetchSessionGroups"
    | "createSessionGroup"
    | "updateSessionGroup"
    | "deleteSessionGroup"
    | "reorderSessionGroups"
    | "updateSession"
    | "deleteSession"
  >;
}

interface WorkspaceLayoutProps {
  api?: WorkspaceLayoutApi;
}

interface WorkspaceSidebarContextValue {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
}

export const WorkspaceSidebarContext = createContext<WorkspaceSidebarContextValue | null>(null);
const defaultSidebarContext: WorkspaceSidebarContextValue = {
  sidebarOpen: false,
  toggleSidebar: () => undefined,
  closeSidebar: () => undefined,
};

export function useWorkspaceSidebar() {
  const context = useContext(WorkspaceSidebarContext);
  return context ?? defaultSidebarContext;
}

export function WorkspaceLayout({ api = mosaicApi }: WorkspaceLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionGroups, setSessionGroups] = useState<SessionGroup[]>([]);
  const [groupManageOpen, setGroupManageOpen] = useState(false);
  const [actionSessionId, setActionSessionId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<Session | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [moveTarget, setMoveTarget] = useState<Session | null>(null);
  const [moveSelectedGroupId, setMoveSelectedGroupId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
  const [deleteWorkspace, setDeleteWorkspace] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const { isDark, toggleDark } = useTheme();
  const displayGroups = useMemo(
    () => [
      ...sessionGroups,
      { id: "__ungrouped__", name: "任务列表", sortOrder: sessionGroups.length },
    ],
    [sessionGroups],
  );

  const activeKey = useMemo(() => {
    if (
      location.pathname === RoutePath.NEW_SESSION ||
      location.pathname === `${RoutePath.CHAT}/new-session` ||
      location.pathname === RoutePath.ROOT
    ) {
      return "new-session";
    }
    if (location.pathname.startsWith(RoutePath.CHAT)) return "chat";
    if (location.pathname.startsWith(RoutePath.CHARACTERS)) return "characters";
    if (location.pathname.startsWith(RoutePath.BOTS_MANAGEMENT)) return "bots";
    if (location.pathname.startsWith(RoutePath.KNOWLEDGE_BASE)) return "knowledge-base";
    if (location.pathname.startsWith(RoutePath.PLUGINS)) return "plugins";
    if (location.pathname.startsWith(RoutePath.SCHEDULER)) return "scheduler";
    if (location.pathname.startsWith(RoutePath.MODELS)) return "models";
    if (location.pathname.startsWith(RoutePath.SETTING)) return "setting";
    return "";
  }, [location.pathname]);
  const isChatWorkspaceRoute = activeKey === "chat";

  const loadSidebarData = useCallback(async () => {
    const groupsResponse = await api.client.fetchSessionGroups();
    const groups = normalizeSessionGroups(groupsResponse);
    const sessionResponses = await Promise.all([
      ...groups.map((group) => api.client.fetchSessions({ skip: 0, limit: 10, groupId: group.id })),
      api.client.fetchSessions({ skip: 0, limit: 10, groupId: null }),
    ]);
    return {
      groups,
      sessions: sessionResponses.flatMap((response) => response.items),
    };
  }, [api]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialSidebarData() {
      try {
        const data = await loadSidebarData();
        if (!cancelled) {
          setSessions(data.sessions);
          setSessionGroups(data.groups);
        }
      } catch {
        if (!cancelled) {
          setSessions([]);
          setSessionGroups([]);
        }
      }
    }

    void loadInitialSidebarData();

    return () => {
      cancelled = true;
    };
  }, [loadSidebarData]);

  useEffect(() => {
    function handleSessionCreated(event: Event) {
      const session = (event as CustomEvent<unknown>).detail;
      if (isSessionLike(session)) {
        setSessions((current) => [
          session,
          ...current.filter((item) => item.id !== session.id),
        ]);
        return;
      }

      void loadSidebarData().then((data) => {
        setSessions(data.sessions);
        setSessionGroups(data.groups);
      });
    }

    window.addEventListener("mosaic-session-created", handleSessionCreated);
    return () => window.removeEventListener("mosaic-session-created", handleSessionCreated);
  }, [loadSidebarData]);

  function handleNavigate(path?: string) {
    if (!path) return;
    void navigate(path);
  }

  function selectSession(session: Session) {
    void navigate(`${RoutePath.CHAT}/${session.id}`);
  }

  function openRenameDialog(session: Session) {
    setActionSessionId(null);
    setRenameTarget(session);
    setRenameDraft(session.title || "未命名任务");
  }

  async function confirmRenameSession() {
    if (!renameTarget) return;
    const title = renameDraft.trim();
    if (!title) return;

    const updated = await api.client.updateSession<Session>(renameTarget.id, { title });
    setSessions((current) =>
      current.map((session) =>
        session.id === renameTarget.id ? { ...session, ...updated, title } : session,
      ),
    );
    setRenameTarget(null);
    setRenameDraft("");
  }

  function openMoveDialog(session: Session) {
    setActionSessionId(null);
    setMoveTarget(session);
    setMoveSelectedGroupId(session.groupId ?? null);
  }

  async function confirmMoveSession() {
    if (!moveTarget) return;

    const updated = await api.client.updateSession<Session>(moveTarget.id, {
      groupId: moveSelectedGroupId,
    });
    setSessions((current) =>
      current.map((session) =>
        session.id === moveTarget.id ? { ...session, ...updated, groupId: moveSelectedGroupId } : session,
      ),
    );
    setMoveTarget(null);
  }

  function openDeleteDialog(session: Session) {
    setActionSessionId(null);
    setDeleteTarget(session);
    setDeleteWorkspace(false);
  }

  async function confirmDeleteSession() {
    if (!deleteTarget) return;

    await api.client.deleteSession(deleteTarget.id, { deleteWorkspace });
    setSessions((current) => current.filter((session) => session.id !== deleteTarget.id));
    if (deleteTarget.id === sessionId) {
      void navigate(`${RoutePath.CHAT}/new-session`);
    }
    setDeleteTarget(null);
    setDeleteWorkspace(false);
  }

  const sidebarContext = useMemo(
    () => ({
      sidebarOpen,
      toggleSidebar: () => setSidebarOpen((current) => !current),
      closeSidebar: () => setSidebarOpen(false),
    }),
    [sidebarOpen],
  );

  const sessionGroupApi: SessionGroupManageApi = useMemo(
    () => ({
      createSessionGroup: (data) => api.client.createSessionGroup<SessionGroup>(data),
      updateSessionGroup: (groupId, data) => api.client.updateSessionGroup<SessionGroup>(groupId, data),
      deleteSessionGroup: (groupId) => api.client.deleteSessionGroup(groupId),
      reorderSessionGroups: (groupIds) => api.client.reorderSessionGroups(groupIds),
    }),
    [api],
  );

  return (
    <WorkspaceSidebarContext.Provider value={sidebarContext}>
      <div
        className={cn(
          "relative flex bg-background text-foreground dark:bg-[#1e1f23] dark:text-[#e8e9ed]",
          isChatWorkspaceRoute ? "h-screen min-h-0 overflow-hidden" : "min-h-screen",
        )}
      >
      <button
        type="button"
        aria-hidden={!sidebarOpen}
        tabIndex={sidebarOpen ? 0 : -1}
        className={cn(
          "fixed inset-0 z-30 cursor-default bg-black/35 transition-opacity duration-300 ease-out lg:hidden",
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        aria-hidden={!sidebarOpen}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col overflow-hidden bg-white shadow-2xl transition-transform duration-300 ease-out will-change-transform dark:bg-[#1e1f23] dark:shadow-[0_12px_32px_rgba(0,0,0,0.45)] lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:shrink-0 lg:translate-x-0 lg:shadow-none lg:transition-[width]",
          sidebarOpen ? "translate-x-0 lg:w-[280px]" : "-translate-x-full lg:w-0 lg:translate-x-0",
        )}
      >
        <div className="flex h-full w-[280px] shrink-0 flex-col">
          <div className="flex-1 overflow-auto px-3 py-3">
            <nav aria-label="主导航" className="space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = item.key === activeKey;
                return (
                  <button
                    key={item.key}
                    type="button"
                    disabled={!item.path}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                      active
                        ? "bg-slate-100 text-foreground dark:bg-[#2a2c30] dark:text-[#e8e9ed]"
                        : "text-foreground hover:bg-slate-100 dark:text-[#e8e9ed] dark:hover:bg-[#2a2c30]",
                      !item.path && "cursor-default opacity-90",
                    )}
                    onClick={() => handleNavigate(item.path)}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <section className="mt-7">
              <div className="space-y-4">
                {displayGroups.map((group) => {
                  const groupId = group.id === "__ungrouped__" ? null : group.id;
                  const groupSessions = sessions.filter((session) => (session.groupId ?? null) === groupId);
                  return (
                    <div key={group.id}>
                      <h2 className="px-3 text-sm font-bold text-foreground">{group.name}</h2>
                      <div className="mt-3 space-y-1">
                        {groupSessions.length > 0 ? (
                          groupSessions.map((session) => (
                    <div
                      key={session.id}
                      className={cn(
                        "group/session relative flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-foreground hover:bg-slate-100 dark:text-[#e8e9ed] dark:hover:bg-[#2a2c30]",
                        session.id === sessionId && "bg-slate-100 dark:bg-[#2a2c30]",
                      )}
                    >
                      <button
                        type="button"
                        aria-label={`打开会话 ${session.title || "未命名任务"}`}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2 rounded-md text-left",
                          session.id === sessionId && "font-semibold",
                        )}
                        onClick={() => selectSession(session)}
                      >
                        <span className="h-1 w-1 rounded-full bg-slate-300" aria-hidden="true" />
                        <span className="truncate">{session.title || "未命名任务"}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`任务操作 ${session.title || "未命名任务"}`}
                        className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-slate-200 hover:text-foreground group-hover/session:opacity-100"
                        onClick={() =>
                          setActionSessionId((current) => (current === session.id ? null : session.id))
                        }
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </button>
                      {actionSessionId === session.id ? (
                        <div
                          role="menu"
                          className="absolute right-2 top-8 z-60 w-36 rounded-lg bg-white p-1 text-sm shadow-[0_12px_32px_rgba(0,0,0,0.15),0_4px_8px_rgba(0,0,0,0.1)] ring-1 ring-gray-200"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-100"
                            onClick={() => openRenameDialog(session)}
                          >
                            <Edit2 className="h-4 w-4" aria-hidden="true" />
                            重命名
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-100"
                            onClick={() => openMoveDialog(session)}
                          >
                            <Folder className="h-4 w-4" aria-hidden="true" />
                            移动到分组
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-red-500 hover:bg-red-50"
                            onClick={() => openDeleteDialog(session)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            删除
                          </button>
                        </div>
                      ) : null}
                    </div>
                          ))
                        ) : (
                          <p className="px-3 py-1.5 text-sm text-muted-foreground">暂无任务</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <footer className="flex items-center justify-between gap-1 px-3 py-3 text-sm text-muted-foreground">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-[#2a2c30]"
              onClick={toggleDark}
            >
              {isDark ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
              {isDark ? "亮色" : "暗色"}
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-[#2a2c30]",
                activeKey === "setting" && "bg-slate-100 text-foreground dark:bg-[#2a2c30] dark:text-[#e8e9ed]",
              )}
              onClick={() => handleNavigate(RoutePath.SETTING_GENERAL)}
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              设置
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-[#2a2c30]"
              onClick={() => setGroupManageOpen(true)}
            >
              <Folder className="h-4 w-4" aria-hidden="true" />
              分组
            </button>
            <button type="button" aria-label="用户中心" className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 dark:bg-[#2a2c30]">
              <CircleUserRound className="h-5 w-5" aria-hidden="true" />
            </button>
          </footer>
        </div>
      </aside>

      <button
        type="button"
        aria-label={sidebarOpen ? "移动端收起侧边栏" : "移动端展开侧边栏"}
        className={cn(
          "fixed top-1/2 z-50 flex h-12 w-4 -translate-y-1/2 items-center justify-center rounded-r-lg border bg-white text-muted-foreground shadow-sm transition-[left] duration-300 ease-out hover:text-foreground lg:hidden",
          sidebarOpen ? "left-[280px]" : "left-0",
        )}
        onClick={sidebarContext.toggleSidebar}
      >
        {sidebarOpen ? (
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      <main className={cn("min-w-0 flex-1", isChatWorkspaceRoute && "min-h-0 overflow-hidden")}>
        <Outlet />
      </main>
      <SessionGroupManageDialog
        open={groupManageOpen}
        groups={sessionGroups}
        api={sessionGroupApi}
        onClose={() => setGroupManageOpen(false)}
        onGroupsChange={setSessionGroups}
      />
      {renameTarget ? (
        <div className="fixed inset-0 z-70 grid place-items-center bg-black/30 px-4">
          <div
            role="dialog"
            aria-labelledby="session-rename-title"
            className="w-full max-w-[420px] rounded-xl bg-white p-5 shadow-[0_12px_32px_rgba(0,0,0,0.15),0_4px_8px_rgba(0,0,0,0.1)] ring-1 ring-gray-200"
          >
            <h2 id="session-rename-title" className="text-base font-semibold text-slate-900">重命名对话</h2>
            <input
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
              className="mt-4 h-10 w-full rounded-md border border-gray-200 px-3 text-sm outline-none focus:border-gray-300"
              placeholder="请输入对话名称"
              autoFocus
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                onClick={() => setRenameTarget(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-md bg-pink-500 px-4 py-2 text-sm font-medium text-white hover:bg-pink-500/90"
                onClick={() => void confirmRenameSession()}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {moveTarget ? (
        <div className="fixed inset-0 z-70 grid place-items-center bg-black/30 px-4">
          <div
            role="dialog"
            aria-labelledby="session-move-title"
            className="w-full max-w-[360px] rounded-xl bg-white p-5 shadow-[0_12px_32px_rgba(0,0,0,0.15),0_4px_8px_rgba(0,0,0,0.1)] ring-1 ring-gray-200"
          >
            <h2 id="session-move-title" className="text-base font-semibold text-slate-900">请选择目标分组</h2>
            <div className="mt-4 space-y-1 py-2">
              {[...sessionGroups, { id: "__ungrouped__", name: "任务列表（未分组）" }].map((group) => {
                const groupId = group.id === "__ungrouped__" ? null : group.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                      moveSelectedGroupId === groupId
                        ? "bg-slate-100 text-foreground"
                        : "text-muted-foreground hover:bg-slate-100 hover:text-foreground",
                    )}
                    onClick={() => setMoveSelectedGroupId(groupId)}
                  >
                    <Folder className="h-4 w-4" aria-hidden="true" />
                    {group.name}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                onClick={() => setMoveTarget(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-md bg-pink-500 px-4 py-2 text-sm font-medium text-white hover:bg-pink-500/90"
                onClick={() => void confirmMoveSession()}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {deleteTarget ? (
        <div className="fixed inset-0 z-70 grid place-items-center bg-black/30 px-4">
          <div
            role="dialog"
            aria-labelledby="session-delete-title"
            className="w-full max-w-[500px] rounded-xl bg-white p-5 shadow-[0_12px_32px_rgba(0,0,0,0.15),0_4px_8px_rgba(0,0,0,0.1)] ring-1 ring-gray-200"
          >
            <h2 id="session-delete-title" className="text-base font-semibold text-slate-900">删除会话</h2>
            <div className="mt-4 space-y-4">
              <p className="text-sm text-slate-600">
                确定要删除会话 <strong>"{deleteTarget.title}"</strong> 吗？
              </p>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                <strong>注意：</strong>此操作不可撤销，会话中的所有消息将被永久删除。
              </div>
              <label className="flex items-start gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={deleteWorkspace}
                  onChange={(event) => setDeleteWorkspace(event.target.checked)}
                />
                <span>
                  <span className="font-medium">同时删除默认工作目录</span>
                  <span className="mt-1 block text-xs text-slate-400">
                    仅删除系统自动创建的默认工作目录，自定义工作目录不会被删除。
                  </span>
                </span>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                onClick={() => setDeleteTarget(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
                onClick={() => void confirmDeleteSession()}
              >
                确定删除
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </WorkspaceSidebarContext.Provider>
  );
}

function normalizeSessionGroups(response: unknown): SessionGroup[] {
  const items =
    Array.isArray(response)
      ? response
      : response && typeof response === "object" && "items" in response
        ? (response as { items?: unknown }).items
        : [];

  if (!Array.isArray(items)) return [];

  return items
    .filter((item): item is { id: string; name: string; sortOrder?: number } => {
      return (
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        "name" in item &&
        typeof (item as { id: unknown }).id === "string" &&
        typeof (item as { name: unknown }).name === "string"
      );
    })
    .map((item, index) => ({
      id: item.id,
      name: item.name,
      sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : index,
    }));
}

function isSessionLike(value: unknown): value is Session {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "title" in value &&
    typeof (value as { id: unknown }).id === "string" &&
    typeof (value as { title: unknown }).title === "string"
  );
}

export default WorkspaceLayout;
