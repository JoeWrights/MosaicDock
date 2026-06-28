import { useEffect, useState } from "react";
import { AlertTriangle, Edit2, Trash2, X, ArrowUp, ArrowDown } from "lucide-react";

export interface SessionGroup {
  id: string;
  name: string;
  sortOrder?: number;
}

export interface SessionGroupManageApi {
  createSessionGroup: (data: { name: string }) => Promise<SessionGroup>;
  updateSessionGroup: (groupId: string, data: { name: string }) => Promise<SessionGroup>;
  deleteSessionGroup: (groupId: string) => Promise<unknown>;
  reorderSessionGroups: (groupIds: string[]) => Promise<unknown>;
}

interface SessionGroupManageDialogProps {
  open: boolean;
  groups: SessionGroup[];
  api: SessionGroupManageApi;
  onClose: () => void;
  onGroupsChange: (groups: SessionGroup[]) => void;
}

export function SessionGroupManageDialog({
  open,
  groups,
  api,
  onClose,
  onGroupsChange,
}: SessionGroupManageDialogProps) {
  const [localGroups, setLocalGroups] = useState<SessionGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SessionGroup | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setLocalGroups(sortGroups(groups));
  }, [groups]);

  if (!open) return null;

  async function createGroup() {
    const name = newGroupName.trim();
    if (!name) return;

    const created = await api.createSessionGroup({ name });
    const nextGroups = normalizeSortOrder([...localGroups, created]);
    setLocalGroups(nextGroups);
    onGroupsChange(nextGroups);
    setNewGroupName("");
  }

  function startEdit(group: SessionGroup) {
    setEditingId(group.id);
    setEditingName(group.name);
  }

  async function saveEdit() {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) return;

    const updated = await api.updateSessionGroup(editingId, { name });
    const nextGroups = normalizeSortOrder(
      localGroups.map((group) => (group.id === editingId ? { ...group, ...updated } : group)),
    );
    setLocalGroups(nextGroups);
    onGroupsChange(nextGroups);
    setEditingId(null);
    setEditingName("");
  }

  async function confirmDeleteGroup() {
    if (!deleteTarget || isDeleting) return;

    setIsDeleting(true);
    try {
      await api.deleteSessionGroup(deleteTarget.id);
      const nextGroups = normalizeSortOrder(localGroups.filter((item) => item.id !== deleteTarget.id));
      setLocalGroups(nextGroups);
      onGroupsChange(nextGroups);
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  }

  async function moveGroup(groupId: string, direction: -1 | 1) {
    const currentIndex = localGroups.findIndex((group) => group.id === groupId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= localGroups.length) return;

    const reordered = [...localGroups];
    const [group] = reordered.splice(currentIndex, 1);
    if (!group) return;
    reordered.splice(nextIndex, 0, group);
    const nextGroups = normalizeSortOrder(reordered);

    await api.reorderSessionGroups(nextGroups.map((item) => item.id));
    setLocalGroups(nextGroups);
    onGroupsChange(nextGroups);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4">
      <div
        role="dialog"
        aria-labelledby="session-group-manage-title"
        className="w-full max-w-[420px] rounded-xl bg-white p-5 shadow-[0_12px_32px_rgba(0,0,0,0.15),0_4px_8px_rgba(0,0,0,0.1)] ring-1 ring-gray-200"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="session-group-manage-title" className="text-base font-semibold text-slate-900">
            分组管理
          </h2>
          <button
            type="button"
            aria-label="关闭分组管理"
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex gap-2">
          <input
            value={newGroupName}
            onChange={(event) => setNewGroupName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void createGroup();
            }}
            placeholder="输入新分组名称"
            maxLength={20}
            className="h-9 min-w-0 flex-1 rounded-md border border-gray-200 px-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-gray-300"
          />
          <button
            type="button"
            className="rounded-md bg-pink-500 px-4 text-sm font-medium text-white transition-colors hover:bg-pink-500/90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!newGroupName.trim()}
            onClick={() => void createGroup()}
          >
            新建
          </button>
        </div>

        <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-gray-100">
          {localGroups.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">暂无自定义分组</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {localGroups.map((group, index) => (
                <div
                  key={group.id}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-center gap-1 text-slate-400">
                    <button
                      type="button"
                      aria-label={`上移 ${group.name}`}
                      className="rounded p-1 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                      disabled={index === 0}
                      onClick={() => void moveGroup(group.id, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`下移 ${group.name}`}
                      className="rounded p-1 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                      disabled={index === localGroups.length - 1}
                      onClick={() => void moveGroup(group.id, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  {editingId === group.id ? (
                    <>
                      <input
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void saveEdit();
                          if (event.key === "Escape") setEditingId(null);
                        }}
                        maxLength={20}
                        className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 px-2 text-sm outline-none focus:border-gray-300"
                        autoFocus
                      />
                      <button
                        type="button"
                        className="rounded-md bg-pink-500 px-2.5 py-1.5 text-xs font-medium text-white"
                        onClick={() => void saveEdit()}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        className="rounded-md px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
                        onClick={() => setEditingId(null)}
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-slate-800">{group.name}</span>
                      <span className="text-xs text-slate-400">{index + 1}</span>
                      <button
                        type="button"
                        aria-label={`重命名 ${group.name}`}
                        className="rounded p-1 text-slate-500 hover:bg-slate-100"
                        onClick={() => startEdit(group)}
                      >
                        <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`删除 ${group.name}`}
                        className="rounded p-1 text-red-400 hover:bg-red-50"
                        onClick={() => setDeleteTarget(group)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 text-xs leading-5 text-slate-400">
          <p>提示：</p>
          <ul className="list-inside list-disc">
            <li>可通过上移/下移调整分组顺序</li>
            <li>删除分组后，该分组下的会话将自动归入“任务列表”</li>
            <li>“任务列表”为默认分组，不可删除或重命名</li>
          </ul>
        </div>
      </div>
      {deleteTarget ? (
        <div className="fixed inset-0 z-60 grid place-items-center bg-black/20 px-4">
          <div
            role="dialog"
            aria-labelledby="session-group-delete-title"
            className="w-full max-w-[380px] rounded-xl bg-white p-5 shadow-[0_16px_40px_rgba(0,0,0,0.18),0_4px_10px_rgba(0,0,0,0.12)] ring-1 ring-gray-200"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-50 text-red-500">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 id="session-group-delete-title" className="text-base font-semibold text-slate-900">
                  删除分组
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  确定要删除分组 "{deleteTarget.name}" 吗？该分组下的会话将自动归入任务列表。
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isDeleting}
                onClick={() => void confirmDeleteGroup()}
              >
                {isDeleting ? "删除中..." : "删除"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function sortGroups(groups: SessionGroup[]): SessionGroup[] {
  return [...groups].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function normalizeSortOrder(groups: SessionGroup[]): SessionGroup[] {
  return groups.map((group, index) => ({ ...group, sortOrder: index }));
}
