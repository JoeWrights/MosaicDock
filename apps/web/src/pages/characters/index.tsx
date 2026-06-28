import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ExternalLink, PanelLeft, Plus, Trash2, UserRound } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { mosaicApi, type ApiClient } from "@mosaic-dock/api-client";
import type {
  Character,
  CharacterGroup,
  CharacterListResponse,
  CreateCharacterRequest,
  Session,
  UpdateCharacterRequest,
} from "@mosaic-dock/shared";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { Input } from "../../components/ui/input";
import { Spinner } from "../../components/ui/spinner";
import { Textarea } from "../../components/ui/textarea";
import { RoutePath } from "../../constants/routes";
import { useWorkspaceSidebar } from "../../layouts/WorkspaceLayout";
import { cn } from "../../lib/utils";

export interface CharactersPageApi {
  client: Pick<
    ApiClient,
    | "fetchCharacters"
    | "fetchCharacterGroups"
    | "createCharacter"
    | "updateCharacter"
    | "deleteCharacter"
    | "createSession"
  >;
}

interface CharactersPageProps {
  api?: CharactersPageApi;
}

interface CharacterFormState {
  title: string;
  description: string;
  systemPrompt: string;
  groupId: string;
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
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Character | null>(null);
  const [form, setForm] = useState<CharacterFormState>({
    title: "",
    description: "",
    systemPrompt: "",
    groupId: "",
  });
  const { tab } = useParams();
  const navigate = useNavigate();
  const { toggleSidebar } = useWorkspaceSidebar();
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
    setForm({
      title: "",
      description: "",
      systemPrompt: "",
      groupId: selectedGroupId ?? "",
    });
    setDialogOpen(true);
  }

  function openEditDialog(character: Character) {
    setEditingCharacter(character);
    setForm({
      title: character.title,
      description: character.description ?? "",
      systemPrompt: character.systemPrompt ?? "",
      groupId: character.groupId ?? "",
    });
    setDialogOpen(true);
  }

  async function submitCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) return;

    const payload: CreateCharacterRequest | UpdateCharacterRequest = {
      title,
      description: form.description.trim(),
      systemPrompt: form.systemPrompt.trim(),
      groupId: form.groupId || null,
    };

    setSaving(true);
    try {
      if (editingCharacter) {
        const updated = await api.client.updateCharacter(editingCharacter.id, payload);
        setCharacters((current) =>
          current.map((character) => (character.id === updated.id ? updated : character)),
        );
      } else {
        const created = await api.client.createCharacter(payload as CreateCharacterRequest);
        if ((created.groupId ?? null) === selectedGroupId) {
          setCharacters((current) => [created, ...current]);
        }
      }
      setDialogOpen(false);
      setEditingCharacter(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "助手保存失败");
    } finally {
      setSaving(false);
    }
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
    <div className="min-h-screen bg-[#f7f8fa] px-5 py-5 text-foreground dark:bg-[#1e1f23] dark:text-[#e8e9ed] lg:px-9">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-[#2f3136]">
        <div className="flex items-start gap-3">
          <button
            type="button"
            aria-label="展开侧边栏"
            className="mt-1 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30] lg:hidden"
            onClick={toggleSidebar}
          >
            <PanelLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <div>
            <h1 className="text-xl font-bold">助手</h1>
            <nav aria-label="角色类型" className="mt-4 flex items-center gap-6 text-sm">
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
          </div>
        </div>
        <a
          href="https://ai.dingd.cn/docs/assistant"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-pink-500 hover:text-pink-600"
        >
          使用说明
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
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
            <span className="text-muted-foreground">+</span>
            <span className="text-muted-foreground">新建分组</span>
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

      {dialogOpen ? (
        <CharacterDialog
          character={editingCharacter}
          form={form}
          groups={groups}
          saving={saving}
          onChange={setForm}
          onClose={() => setDialogOpen(false)}
          onSubmit={submitCharacter}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteDialog
          character={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDeleteCharacter()}
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

function CharacterDialog({
  character,
  form,
  groups,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  character: Character | null;
  form: CharacterFormState;
  groups: CharacterGroup[];
  saving: boolean;
  onChange: (form: CharacterFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-70 grid place-items-center bg-black/30 px-4">
      <form
        role="dialog"
        aria-labelledby="character-dialog-title"
        className="w-full max-w-[640px] rounded-2xl bg-white p-6 shadow-[0_18px_48px_rgba(0,0,0,0.18)] ring-1 ring-slate-200 dark:bg-[#232428] dark:ring-[#2f3136]"
        onSubmit={onSubmit}
      >
        <h2 id="character-dialog-title" className="text-lg font-bold">
          {character ? "角色设置" : "新建助手"}
        </h2>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium">
            名称
            <Input
              value={form.title}
              onChange={(event) => onChange({ ...form, title: event.target.value })}
              className="mt-2"
              placeholder="请输入助手名称"
              autoFocus
            />
          </label>
          <label className="block text-sm font-medium">
            描述
            <Textarea
              value={form.description}
              onChange={(event) => onChange({ ...form, description: event.target.value })}
              className="mt-2 min-h-20"
              placeholder="介绍这个助手适合处理的问题"
            />
          </label>
          <label className="block text-sm font-medium">
            系统提示词
            <Textarea
              value={form.systemPrompt}
              onChange={(event) => onChange({ ...form, systemPrompt: event.target.value })}
              className="mt-2 min-h-28"
              placeholder="定义助手的角色、语气和工作方式"
            />
          </label>
          <label className="block text-sm font-medium">
            分组
            <select
              value={form.groupId}
              onChange={(event) => onChange({ ...form, groupId: event.target.value })}
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring"
            >
              <option value="">未分组</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            type="submit"
            className="bg-pink-500 text-white shadow-none hover:bg-pink-500/90"
            disabled={saving || !form.title.trim()}
          >
            {saving ? "保存中..." : "保存设置"}
          </Button>
        </div>
      </form>
    </div>
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
