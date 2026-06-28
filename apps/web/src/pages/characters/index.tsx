import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus, Trash2, UserRound } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { mosaicApi, type ApiClient } from "@mosaic-dock/api-client";
import type {
  Character,
  CharacterGroup,
  CharacterListResponse,
} from "@mosaic-dock/shared";
import { WorkspacePageHeader } from "../../components/layout/WorkspacePageHeader";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { Input } from "../../components/ui/input";
import { Spinner } from "../../components/ui/spinner";
import { RoutePath } from "../../constants/routes";
import { cn } from "../../lib/utils";
import CharacterModal from "./CharacterModal";

export interface CharactersPageApi {
  client: Pick<
    ApiClient,
    | "fetchCharacters"
    | "fetchCharacter"
    | "fetchCharacterGroups"
    | "fetchModels"
    | "fetchSkills"
    | "fetchMcpServers"
    | "fetchCharacterTools"
    | "createCharacterGroup"
    | "createCharacter"
    | "updateCharacter"
    | "uploadCharacterAvatar"
    | "deleteCharacter"
    | "createSession"
  >;
}

interface CharactersPageProps {
  api?: CharactersPageApi;
}

const pageSize = 60;

export function CharactersPage({ api = mosaicApi }: CharactersPageProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [groups, setGroups] = useState<CharacterGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [loadingCharacters, setLoadingCharacters] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Character | null>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupDraft, setGroupDraft] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
  const { tab } = useParams();
  const navigate = useNavigate();
  const activeTab = tab ?? "assistants";
  const isLoading = loadingCharacters || loadingGroups;
  const selectedGroupName = useMemo(
    () => groups.find((group) => group.id === selectedGroupId)?.name ?? "全部",
    [groups, selectedGroupId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadGroups() {
      setLoadingGroups(true);
      try {
        const response = await api.client.fetchCharacterGroups();
        if (!cancelled) {
          setGroups(normalizeCharacterGroups(response));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "助手分组加载失败");
          setGroups([]);
        }
      } finally {
        if (!cancelled) setLoadingGroups(false);
      }
    }

    void loadGroups();

    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (activeTab !== "assistants") return;

    let cancelled = false;

    async function loadCharacters() {
      setLoadingCharacters(true);
      setError(null);
      try {
        const response = await api.client.fetchCharacters({
          skip: 0,
          limit: pageSize,
          groupId: selectedGroupId,
        });
        if (!cancelled) {
          setCharacters(normalizeCharacterList(response));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "助手加载失败");
          setCharacters([]);
        }
      } finally {
        if (!cancelled) setLoadingCharacters(false);
      }
    }

    void loadCharacters();

    return () => {
      cancelled = true;
    };
  }, [activeTab, api, selectedGroupId]);

  function openCreateDialog() {
    setEditingCharacter(null);
    setDialogOpen(true);
  }

  function openEditDialog(character: Character) {
    setEditingCharacter(character);
    setDialogOpen(true);
  }

  function handleCharacterSaved(character: Character) {
    setCharacters((current) => {
      const exists = current.some((item) => item.id === character.id);
      if (exists) {
        return current.map((item) => (item.id === character.id ? character : item));
      }
      if ((character.groupId ?? null) !== selectedGroupId) return current;
      return [character, ...current];
    });
    setEditingCharacter(null);
  }

  async function confirmDeleteCharacter() {
    if (!deleteTarget) return;

    try {
      await api.client.deleteCharacter(deleteTarget.id);
      setCharacters((current) => current.filter((character) => character.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "助手删除失败");
    }
  }

  async function submitCharacterGroup() {
    const name = groupDraft.trim();
    if (!name) return;

    setSavingGroup(true);
    setError(null);
    try {
      const created = await api.client.createCharacterGroup({ name });
      setGroups((current) => normalizeCharacterGroups([...current, created]));
      setSelectedGroupId(created.id);
      setGroupDialogOpen(false);
      setGroupDraft("");
    } catch (groupError) {
      setError(groupError instanceof Error ? groupError.message : "助手分组创建失败");
    } finally {
      setSavingGroup(false);
    }
  }

  async function useCharacter(character: Character) {
    try {
      const session = await api.client.createSession({
        characterId: character.id,
        title: character.title,
      });
      navigate(`${RoutePath.CHAT}/${session.id}`);
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : "创建会话失败");
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] px-5 pb-5 text-foreground dark:bg-[#1e1f23] dark:text-[#e8e9ed]">
      <header className="border-b border-slate-200 pb-4 dark:border-[#2f3136]">
        <WorkspacePageHeader
          title="助手"
          actions={
            <a
              href="https://ai.dingd.cn/docs/assistant"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-normal text-pink-500 hover:text-pink-600"
            >
              使用说明
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          }
        />
        <nav aria-label="角色类型" className="flex items-center gap-6 text-sm">
          <button
            type="button"
            className={cn(
              "border-b-2 pb-2 transition-colors",
              activeTab === "assistants"
                ? "border-pink-500 text-pink-500"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => navigate("/characters/assistants")}
          >
            助手
          </button>
          <button
            type="button"
            className={cn(
              "border-b-2 pb-2 transition-colors",
              activeTab === "teams"
                ? "border-pink-500 text-pink-500"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => navigate("/characters/teams")}
          >
            团队
          </button>
        </nav>
      </header>

      {activeTab === "teams" ? (
        <div className="mt-12">
          <EmptyState description="团队功能将在下一阶段迁移。" />
        </div>
      ) : (
        <section className="mt-5">
          <Button
            className="h-9 rounded-md bg-linear-to-r from-pink-500 to-rose-500 px-4 text-white shadow-none hover:from-pink-500/90 hover:to-rose-500/90"
            onClick={openCreateDialog}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            新建助手
          </Button>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <button
              type="button"
              className={cn(
                "rounded-full px-2 py-1 font-semibold transition-colors",
                selectedGroupId === null
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]",
              )}
              onClick={() => setSelectedGroupId(null)}
            >
              全部
            </button>
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                className={cn(
                  "rounded-full px-2 py-1 transition-colors",
                  selectedGroupId === group.id
                    ? "bg-slate-100 font-semibold text-foreground dark:bg-[#2a2c30]"
                    : "text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]",
                )}
                onClick={() => setSelectedGroupId(group.id)}
              >
                {group.name}
              </button>
            ))}
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]"
              onClick={() => setGroupDialogOpen(true)}
            >
              <span aria-hidden="true">+</span>
              新建分组
            </button>
          </div>

          {error ? (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          <div className="mt-6">
            {isLoading ? (
              <div className="grid min-h-48 place-items-center">
                <Spinner label="正在加载助手" />
              </div>
            ) : characters.length === 0 ? (
              <EmptyState description={`${selectedGroupName}下暂无助手`} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {characters.map((character) => (
                  <CharacterCard
                    key={character.id}
                    character={character}
                    onUse={() => void useCharacter(character)}
                    onEdit={() => openEditDialog(character)}
                    onDelete={() => setDeleteTarget(character)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <CharacterModal
        open={dialogOpen}
        characterId={editingCharacter?.id ?? null}
        groups={groups}
        api={api}
        onClose={() => {
          setDialogOpen(false);
          setEditingCharacter(null);
        }}
        onSaved={handleCharacterSaved}
      />

      {deleteTarget ? (
        <DeleteDialog
          character={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDeleteCharacter()}
        />
      ) : null}

      {groupDialogOpen ? (
        <CharacterGroupDialog
          value={groupDraft}
          saving={savingGroup}
          onChange={setGroupDraft}
          onCancel={() => {
            setGroupDialogOpen(false);
            setGroupDraft("");
          }}
          onConfirm={() => void submitCharacterGroup()}
        />
      ) : null}
    </div>
  );
}

function CharacterCard({
  character,
  onUse,
  onEdit,
  onDelete,
}: {
  character: Character;
  onUse: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const label = character.type === "private" ? "私有角色" : "共享模板";
  const avatarText = character.title.trim().slice(0, 1) || "助";

  return (
    <article
      data-testid={`character-card-${character.id}`}
      className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] dark:border-[#2f3136] dark:bg-[#232428]"
    >
      {character.avatarUrl ? (
        <img
          src={character.avatarUrl}
          alt=""
          className="absolute -right-6 -top-6 h-24 w-24 rounded-full object-cover opacity-10 blur-xl"
        />
      ) : null}
      <div className="relative flex gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 text-lg font-bold text-slate-700 dark:bg-[#2a2c30] dark:text-[#e8e9ed]">
          {character.avatarUrl ? (
            <img src={character.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            avatarText
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="truncate text-base font-bold">{character.title}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
            </div>
            <button
              type="button"
              aria-label={`删除 ${character.title}`}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
            {character.description || "暂无描述"}
          </p>
        </div>
      </div>
      <div className="relative mt-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          aria-label={`使用此角色 ${character.title}`}
          onClick={onUse}
        >
          <UserRound className="h-4 w-4" aria-hidden="true" />
          使用此角色
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`角色设置 ${character.title}`}
          onClick={onEdit}
        >
          角色设置
        </Button>
      </div>
    </article>
  );
}

function DeleteDialog({
  character,
  onCancel,
  onConfirm,
}: {
  character: Character;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-70 grid place-items-center bg-black/30 px-4">
      <div
        role="dialog"
        aria-labelledby="character-delete-title"
        className="w-full max-w-[420px] rounded-xl bg-white p-5 shadow-[0_12px_32px_rgba(0,0,0,0.15)] ring-1 ring-slate-200 dark:bg-[#232428] dark:ring-[#2f3136]"
      >
        <h2 id="character-delete-title" className="text-base font-semibold">
          删除助手
        </h2>
        <p className="mt-4 text-sm text-muted-foreground">
          确定要删除助手 <strong className="text-foreground">"{character.title}"</strong> 吗？
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            取消
          </Button>
          <Button className="bg-red-500 text-white shadow-none hover:bg-red-600" onClick={onConfirm}>
            确定删除
          </Button>
        </div>
      </div>
    </div>
  );
}

function CharacterGroupDialog({
  value,
  saving,
  onChange,
  onCancel,
  onConfirm,
}: {
  value: string;
  saving: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-70 grid place-items-center bg-white/75 px-4 backdrop-blur-[1px] dark:bg-black/50">
      <div
        role="dialog"
        aria-labelledby="character-group-title"
        className="w-full max-w-[360px] rounded-xl bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,0.22)] ring-1 ring-slate-200 dark:bg-[#232428] dark:ring-[#2f3136]"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="character-group-title" className="text-sm font-semibold">
            新建分组
          </h2>
          <button
            type="button"
            aria-label="关闭新建分组"
            className="rounded-md px-1 text-muted-foreground hover:text-foreground"
            onClick={onCancel}
          >
            ×
          </button>
        </div>
        <label className="mt-4 block text-sm">
          请输入分组名称
          <Input
            aria-label="分组名称"
            className="mt-2"
            value={value}
            autoFocus
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onConfirm();
              }
            }}
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            取消
          </Button>
          <Button
            size="sm"
            className="bg-pink-500 text-white shadow-none hover:bg-pink-500/90"
            disabled={saving || !value.trim()}
            onClick={onConfirm}
          >
            {saving ? "创建中..." : "确定"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function normalizeCharacterList(response: CharacterListResponse | unknown): Character[] {
  const items =
    response && typeof response === "object" && "items" in response
      ? (response as { items?: unknown }).items
      : Array.isArray(response)
        ? response
        : [];

  if (!Array.isArray(items)) return [];

  return items.filter((item): item is Character => {
    return (
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      "title" in item &&
      typeof (item as { id: unknown }).id === "string" &&
      typeof (item as { title: unknown }).title === "string"
    );
  });
}

function normalizeCharacterGroups(response: CharacterGroup[] | unknown): CharacterGroup[] {
  if (!Array.isArray(response)) return [];

  return response
    .filter((item): item is CharacterGroup => {
      return (
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        "name" in item &&
        typeof (item as { id: unknown }).id === "string" &&
        typeof (item as { name: unknown }).name === "string"
      );
    })
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
}

export default CharactersPage;
