import { useEffect, useMemo, useState } from "react";
import { CheckCircle, ExternalLink, Plus, Search, Trash2, UserRound, UsersRound } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { mosaicApi, type ApiClient } from "@mosaic-dock/api-client";
import type {
  Character,
  CharacterGroup,
  CharacterListResponse,
  CreateTeamRequest,
  Team,
  TeamListResponse,
  TeamMember,
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
    | "fetchTeams"
    | "createTeam"
    | "updateTeam"
    | "deleteTeam"
    | "createSession"
  >;
}

interface CharactersPageProps {
  api?: CharactersPageApi;
}

const pageSize = 60;

interface TeamFormState {
  name: string;
  description: string;
  leaderCharacterId: string;
  memberCharacterIds: string[];
}

type CharacterSelectorMode = "leader" | "member" | null;

const emptyTeamForm: TeamFormState = {
  name: "",
  description: "",
  leaderCharacterId: "",
  memberCharacterIds: [],
};

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
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamForm, setTeamForm] = useState<TeamFormState>(emptyTeamForm);
  const [savingTeam, setSavingTeam] = useState(false);
  const [teamDeleteTarget, setTeamDeleteTarget] = useState<Team | null>(null);
  const [selectorMode, setSelectorMode] = useState<CharacterSelectorMode>(null);
  const [selectorSearch, setSelectorSearch] = useState("");
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

  useEffect(() => {
    if (activeTab !== "teams") return;

    let cancelled = false;

    async function loadTeamData() {
      setLoadingTeams(true);
      setError(null);
      try {
        const [characterResponse, teamResponse] = await Promise.all([
          api.client.fetchCharacters({ skip: 0, limit: pageSize }),
          api.client.fetchTeams(),
        ]);
        if (!cancelled) {
          setCharacters(normalizeCharacterList(characterResponse));
          setTeams(normalizeTeams(teamResponse));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "团队加载失败");
          setTeams([]);
        }
      } finally {
        if (!cancelled) setLoadingTeams(false);
      }
    }

    void loadTeamData();

    return () => {
      cancelled = true;
    };
  }, [activeTab, api]);

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
      notifySessionCreated(session);
      navigate(`${RoutePath.CHAT}/${session.id}`);
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : "创建会话失败");
    }
  }

  function openCreateTeamDialog() {
    setEditingTeam(null);
    setTeamForm(emptyTeamForm);
    setTeamDialogOpen(true);
  }

  function openEditTeamDialog(team: Team) {
    setEditingTeam(team);
    setTeamForm({
      name: team.name ?? "",
      description: team.description ?? "",
      leaderCharacterId: team.leaderCharacterId ?? "",
      memberCharacterIds: (team.members ?? [])
        .filter((member) => member.role !== "leader")
        .map((member) => member.characterId)
        .filter(Boolean),
    });
    setTeamDialogOpen(true);
  }

  function closeTeamDialog() {
    setTeamDialogOpen(false);
    setEditingTeam(null);
    setTeamForm(emptyTeamForm);
    setSelectorMode(null);
    setSelectorSearch("");
  }

  async function reloadTeams() {
    const response = await api.client.fetchTeams();
    setTeams(normalizeTeams(response));
  }

  async function submitTeam() {
    const payload: CreateTeamRequest = {
      name: teamForm.name.trim(),
      description: teamForm.description.trim(),
      leaderCharacterId: teamForm.leaderCharacterId,
      memberCharacterIds: teamForm.memberCharacterIds,
    };
    if (!payload.name || !payload.leaderCharacterId) return;

    setSavingTeam(true);
    setError(null);
    try {
      if (editingTeam) {
        await api.client.updateTeam(editingTeam.id, payload);
      } else {
        await api.client.createTeam(payload);
      }
      closeTeamDialog();
      await reloadTeams();
    } catch (teamError) {
      setError(teamError instanceof Error ? teamError.message : "保存团队失败");
    } finally {
      setSavingTeam(false);
    }
  }

  async function confirmDeleteTeam() {
    if (!teamDeleteTarget) return;

    try {
      await api.client.deleteTeam(teamDeleteTarget.id);
      setTeams((current) => current.filter((team) => team.id !== teamDeleteTarget.id));
      setTeamDeleteTarget(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除团队失败");
    }
  }

  async function startTeamChat(team: Team) {
    try {
      const session = await api.client.createSession({
        teamId: team.id,
        title: team.name,
      });
      notifySessionCreated(session);
      navigate(`${RoutePath.CHAT}/${session.id}`);
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : "创建团队会话失败");
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
              "inline-flex items-center gap-1.5 border-b-2 pb-2 transition-colors",
              activeTab === "assistants"
                ? "border-pink-500 text-pink-500"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => navigate("/characters/assistants")}
          >
            <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
            助手
          </button>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 pb-2 transition-colors",
              activeTab === "teams"
                ? "border-pink-500 text-pink-500"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => navigate("/characters/teams")}
          >
            <UsersRound className="h-3.5 w-3.5" aria-hidden="true" />
            团队
          </button>
        </nav>
      </header>

      {activeTab === "teams" ? (
        <section className="mt-5">
          <div className="flex items-center justify-between gap-4">
            <Button
              className="h-9 rounded-md bg-linear-to-r from-pink-500 to-rose-500 px-4 text-white shadow-none hover:from-pink-500/90 hover:to-rose-500/90"
              onClick={openCreateTeamDialog}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              新建团队
            </Button>
            <span className="text-sm text-muted-foreground">将多个角色组合成协作团队</span>
          </div>

          {error ? (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          <div className="mt-6">
            {loadingTeams ? (
              <div className="grid min-h-48 place-items-center">
                <Spinner label="正在加载团队" />
              </div>
            ) : teams.length === 0 ? (
              <EmptyState description="创建一个团队，组合多个角色协同工作" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {teams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    onStart={() => void startTeamChat(team)}
                    onEdit={() => openEditTeamDialog(team)}
                    onDelete={() => setTeamDeleteTarget(team)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
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

      {teamDialogOpen ? (
        <TeamDialog
          form={teamForm}
          characters={characters}
          editing={Boolean(editingTeam)}
          saving={savingTeam}
          onChange={setTeamForm}
          onCancel={closeTeamDialog}
          onSubmit={() => void submitTeam()}
          onOpenLeaderSelector={() => {
            setSelectorMode("leader");
            setSelectorSearch("");
          }}
          onOpenMemberSelector={() => {
            setSelectorMode("member");
            setSelectorSearch("");
          }}
        />
      ) : null}

      {selectorMode ? (
        <CharacterSelectorDialog
          mode={selectorMode}
          characters={characters}
          form={teamForm}
          search={selectorSearch}
          onSearchChange={setSelectorSearch}
          onChange={setTeamForm}
          onClose={() => {
            setSelectorMode(null);
            setSelectorSearch("");
          }}
        />
      ) : null}

      {teamDeleteTarget ? (
        <TeamDeleteDialog
          team={teamDeleteTarget}
          onCancel={() => setTeamDeleteTarget(null)}
          onConfirm={() => void confirmDeleteTeam()}
        />
      ) : null}
    </div>
  );
}

function TeamCard({
  team,
  onStart,
  onEdit,
  onDelete,
}: {
  team: Team;
  onStart: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const avatarText = team.name.trim().slice(0, 1) || "团";
  const members = team.members ?? [];

  return (
    <article className="group relative min-h-[150px] overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-pink-300 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] dark:border-[#2f3136] dark:bg-[#232428]">
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start gap-3">
          <AvatarBlock src={team.avatarUrl ?? team.leader?.avatarUrl} name={team.name} fallback={avatarText} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="truncate text-base font-bold" title={team.name}>
                  {team.name}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">{getMemberSummary(team)}</p>
              </div>
              <button
                type="button"
                aria-label={`删除团队 ${team.name}`}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <p className="mt-3 line-clamp-2 min-h-8 text-xs leading-5 text-muted-foreground">
          {team.description || "暂无描述"}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5 pb-8">
          {members.map((member) => {
            const name = getTeamMemberName(member);
            return (
              <span
                key={member.id ?? member.characterId}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                  member.role === "leader"
                    ? "border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                    : "bg-slate-100 text-muted-foreground dark:bg-[#2a2c30]",
                )}
              >
                <AvatarBlock
                  src={member.character?.avatarUrl ?? member.characterSnapshot?.avatarUrl}
                  name={name}
                  fallback={name.slice(0, 1) || "成"}
                  size="sm"
                />
                <span>{name}</span>
                {member.role === "leader" ? <span className="text-[10px]">主理</span> : null}
              </span>
            );
          })}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-white via-white/90 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:from-[#232428] dark:via-[#232428]/90" />
        <div className="absolute inset-x-0 bottom-0 z-20 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Button size="sm" className="flex-1 bg-pink-500 text-white shadow-sm hover:bg-pink-500/90" onClick={onStart}>
            开始协作
          </Button>
          <Button size="sm" variant="secondary" className="flex-1 shadow-sm" onClick={onEdit}>
            团队设置
          </Button>
        </div>
      </div>
    </article>
  );
}

function TeamDialog({
  form,
  characters,
  editing,
  saving,
  onChange,
  onCancel,
  onSubmit,
  onOpenLeaderSelector,
  onOpenMemberSelector,
}: {
  form: TeamFormState;
  characters: Character[];
  editing: boolean;
  saving: boolean;
  onChange: (form: TeamFormState) => void;
  onCancel: () => void;
  onSubmit: () => void;
  onOpenLeaderSelector: () => void;
  onOpenMemberSelector: () => void;
}) {
  const leader = characters.find((character) => character.id === form.leaderCharacterId);
  const canSubmit = Boolean(form.name.trim() && form.leaderCharacterId);

  return (
    <div className="fixed inset-0 z-70 grid place-items-center bg-white/75 px-4 backdrop-blur-[1px] dark:bg-black/50">
      <div
        role="dialog"
        aria-labelledby="team-dialog-title"
        className="w-full max-w-[560px] rounded-xl bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.22)] ring-1 ring-slate-200 dark:bg-[#232428] dark:ring-[#2f3136]"
      >
        <h2 id="team-dialog-title" className="text-base font-semibold">
          {editing ? "编辑团队" : "新建团队"}
        </h2>

        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium">
            团队名称
            <Input
              aria-label="团队名称"
              className="mt-2"
              value={form.name}
              maxLength={30}
              placeholder="如：视频制作、内容策划"
              onChange={(event) => onChange({ ...form, name: event.target.value })}
            />
          </label>

          <label className="block text-sm font-medium">
            团队描述
            <textarea
              aria-label="团队描述"
              className="mt-2 min-h-20 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-[#3a3c42] dark:focus:ring-pink-500/20"
              value={form.description}
              maxLength={200}
              placeholder="简单描述团队的用途"
              onChange={(event) => onChange({ ...form, description: event.target.value })}
            />
          </label>

          <div>
            <p className="text-sm font-medium">主理人（团队核心角色）</p>
            <button
              type="button"
              className="mt-2 w-full rounded-lg bg-slate-50 p-2 text-left transition hover:bg-slate-100 dark:bg-[#2a2c30] dark:hover:bg-[#2f3136]"
              onClick={onOpenLeaderSelector}
            >
              {leader ? (
                <div className="flex items-center gap-2">
                  <AvatarBlock src={leader.avatarUrl} name={leader.title} fallback={leader.title.slice(0, 1)} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{leader.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {leader.description || "暂无描述"}
                    </p>
                  </div>
                </div>
              ) : (
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  选择主理人角色
                </span>
              )}
            </button>
          </div>

          <div>
            <p className="text-sm font-medium">团队成员</p>
            <div className="mt-2 space-y-2">
              {form.memberCharacterIds.map((characterId) => {
                const character = characters.find((item) => item.id === characterId);
                return (
                  <div
                    key={characterId}
                    className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 dark:bg-[#2a2c30]"
                  >
                    <AvatarBlock
                      src={character?.avatarUrl}
                      name={character?.title}
                      fallback={character?.title?.slice(0, 1) || "成"}
                    />
                    <span className="flex-1 text-sm">{character?.title || "未知角色"}</span>
                    <button
                      type="button"
                      aria-label={`移除成员 ${character?.title || characterId}`}
                      className="rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-500"
                      onClick={() =>
                        onChange({
                          ...form,
                          memberCharacterIds: form.memberCharacterIds.filter((id) => id !== characterId),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
              <Button size="sm" variant="secondary" disabled={!form.leaderCharacterId} onClick={onOpenMemberSelector}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                添加成员
              </Button>
              {!form.leaderCharacterId ? (
                <p className="text-xs text-muted-foreground">请先选择主理人</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            取消
          </Button>
          <Button
            className="bg-pink-500 text-white shadow-none hover:bg-pink-500/90"
            disabled={saving || !canSubmit}
            onClick={onSubmit}
          >
            {saving ? "保存中..." : editing ? "保存" : "创建"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CharacterSelectorDialog({
  mode,
  characters,
  form,
  search,
  onSearchChange,
  onChange,
  onClose,
}: {
  mode: Exclude<CharacterSelectorMode, null>;
  characters: Character[];
  form: TeamFormState;
  search: string;
  onSearchChange: (value: string) => void;
  onChange: (form: TeamFormState) => void;
  onClose: () => void;
}) {
  const normalizedSearch = search.trim().toLowerCase();
  const filteredCharacters = characters.filter((character) => {
    if (mode === "member" && character.id === form.leaderCharacterId) return false;
    if (!normalizedSearch) return true;
    return `${character.title} ${character.description ?? ""}`.toLowerCase().includes(normalizedSearch);
  });
  const title = mode === "leader" ? "选择主理人" : "添加团队成员";

  function selectCharacter(character: Character) {
    if (mode === "leader") {
      onChange({
        ...form,
        leaderCharacterId: character.id,
        memberCharacterIds: form.memberCharacterIds.filter((id) => id !== character.id),
      });
      onClose();
      return;
    }

    const selected = form.memberCharacterIds.includes(character.id);
    onChange({
      ...form,
      memberCharacterIds: selected
        ? form.memberCharacterIds.filter((id) => id !== character.id)
        : [...form.memberCharacterIds, character.id],
    });
  }

  return (
    <div className="fixed inset-0 z-80 grid place-items-center bg-white/75 px-4 backdrop-blur-[1px] dark:bg-black/50">
      <div
        role="dialog"
        aria-labelledby={`team-${mode}-selector-title`}
        className="w-full max-w-[400px] rounded-xl bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,0.22)] ring-1 ring-slate-200 dark:bg-[#232428] dark:ring-[#2f3136]"
      >
        <h2 id={`team-${mode}-selector-title`} className="text-base font-semibold">
          {title}
        </h2>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="搜索角色"
            className="pl-9"
            value={search}
            placeholder="搜索角色..."
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
          {filteredCharacters.map((character) => {
            const selected =
              mode === "leader"
                ? form.leaderCharacterId === character.id
                : form.memberCharacterIds.includes(character.id);
            return (
              <button
                key={character.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-slate-50 dark:hover:bg-[#2f3136]",
                  selected ? "bg-blue-50 dark:bg-[#2f3136]" : "",
                )}
                onClick={() => selectCharacter(character)}
              >
                <AvatarBlock src={character.avatarUrl} name={character.title} fallback={character.title.slice(0, 1)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{character.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {character.description || "暂无描述"}
                  </span>
                </span>
                {selected ? <CheckCircle className="h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
        {mode === "member" ? (
          <div className="mt-4 flex justify-end">
            <Button size="sm" onClick={onClose}>
              完成
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TeamDeleteDialog({
  team,
  onCancel,
  onConfirm,
}: {
  team: Team;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-70 grid place-items-center bg-black/30 px-4">
      <div
        role="dialog"
        aria-labelledby="team-delete-title"
        className="w-full max-w-[420px] rounded-xl bg-white p-5 shadow-[0_12px_32px_rgba(0,0,0,0.15)] ring-1 ring-slate-200 dark:bg-[#232428] dark:ring-[#2f3136]"
      >
        <h2 id="team-delete-title" className="text-base font-semibold">
          删除团队
        </h2>
        <p className="mt-4 text-sm text-muted-foreground">
          确定要删除团队 <strong className="text-foreground">"{team.name}"</strong> 吗？此操作不可撤销。
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

function AvatarBlock({
  src,
  name,
  fallback,
  size = "md",
}: {
  src?: string | null;
  name?: string | null;
  fallback: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 font-semibold text-slate-700 dark:bg-[#2a2c30] dark:text-[#e8e9ed]",
        size === "sm" ? "h-4 w-4 text-[10px]" : "h-10 w-10 text-sm",
      )}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : name?.trim().slice(0, 1) || fallback}
    </span>
  );
}

function getTeamMemberName(member: TeamMember) {
  return member.character?.title || member.characterSnapshot?.title || "成员";
}

function getMemberSummary(team: Team) {
  const members = team.members ?? [];
  const leaderCount = members.filter((member) => member.role === "leader").length;
  const memberCount = members.filter((member) => member.role !== "leader").length;
  if (leaderCount === 0 && memberCount === 0) return "暂无成员";
  return [
    leaderCount > 0 ? `${leaderCount} 位主理人` : null,
    memberCount > 0 ? `${memberCount} 位成员` : null,
  ]
    .filter(Boolean)
    .join(" · ");
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

function normalizeTeams(response: TeamListResponse | Team[] | unknown): Team[] {
  const items =
    response && typeof response === "object" && "items" in response
      ? (response as { items?: unknown }).items
      : Array.isArray(response)
        ? response
        : [];

  if (!Array.isArray(items)) return [];

  return items.filter((item): item is Team => {
    return (
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      "name" in item &&
      typeof (item as { id: unknown }).id === "string" &&
      typeof (item as { name: unknown }).name === "string"
    );
  });
}

function notifySessionCreated(session: unknown) {
  window.dispatchEvent(new CustomEvent("mosaic-session-created", { detail: session }));
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
