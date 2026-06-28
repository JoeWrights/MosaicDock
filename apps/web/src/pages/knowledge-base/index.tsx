import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  BookOpen,
  FileText,
  Folder,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { mosaicApi } from "@mosaic-dock/api-client";
import type {
  CreateKnowledgeBaseFolderRequest,
  CreateKnowledgeBaseRequest,
  KnowledgeBase,
  KnowledgeBaseFile,
  KnowledgeBaseFileListParams,
  KnowledgeBaseFileListResponse,
  KnowledgeBaseListParams,
  KnowledgeBaseListResponse,
  RenameKnowledgeBaseFileRequest,
  UpdateKnowledgeBaseRequest,
} from "@mosaic-dock/shared";
import { WorkspacePageHeader } from "../../components/layout/WorkspacePageHeader";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { Input } from "../../components/ui/input";
import { Spinner } from "../../components/ui/spinner";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../lib/utils";

export interface KnowledgeBasePageApi {
  client: {
    fetchKnowledgeBases: (params?: KnowledgeBaseListParams) => Promise<KnowledgeBaseListResponse>;
    createKnowledgeBase: (data: CreateKnowledgeBaseRequest) => Promise<KnowledgeBase>;
    updateKnowledgeBase: (
      knowledgeBaseId: string,
      data: UpdateKnowledgeBaseRequest,
    ) => Promise<KnowledgeBase>;
    deleteKnowledgeBase: (knowledgeBaseId: string) => Promise<{ success: boolean }>;
    fetchKnowledgeBaseFiles: (
      knowledgeBaseId: string,
      params?: KnowledgeBaseFileListParams,
    ) => Promise<KnowledgeBaseFileListResponse>;
    uploadKnowledgeBaseFile: (
      knowledgeBaseId: string,
      file: File,
      relativePath?: string,
    ) => Promise<KnowledgeBaseFile>;
    createKnowledgeBaseFolder: (
      knowledgeBaseId: string,
      data: CreateKnowledgeBaseFolderRequest,
    ) => Promise<KnowledgeBaseFile>;
    renameKnowledgeBaseFile: (
      knowledgeBaseId: string,
      fileId: string,
      data: RenameKnowledgeBaseFileRequest,
    ) => Promise<KnowledgeBaseFile>;
    deleteKnowledgeBaseFile: (
      knowledgeBaseId: string,
      fileId: string,
    ) => Promise<{ success: boolean }>;
    retryKnowledgeBaseFile: (
      knowledgeBaseId: string,
      fileId: string,
    ) => Promise<{ success: boolean }>;
  };
}

interface KnowledgeBasePageProps {
  api?: KnowledgeBasePageApi;
}

interface KnowledgeBaseFormState {
  name: string;
  description: string;
  embeddingModelId: string;
}

const defaultFormState: KnowledgeBaseFormState = {
  name: "",
  description: "",
  embeddingModelId: "",
};

const listParams = { skip: 0, limit: 50 };

export function KnowledgeBasePage({ api = mosaicApi }: KnowledgeBasePageProps) {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [files, setFiles] = useState<KnowledgeBaseFile[]>([]);
  const [query, setQuery] = useState("");
  const [loadingBases, setLoadingBases] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBase, setEditingBase] = useState<KnowledgeBase | null>(null);
  const [formState, setFormState] = useState<KnowledgeBaseFormState>(defaultFormState);
  const [deleteBaseTarget, setDeleteBaseTarget] = useState<KnowledgeBase | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [renameTarget, setRenameTarget] = useState<KnowledgeBaseFile | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteFileTarget, setDeleteFileTarget] = useState<KnowledgeBaseFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedBase = useMemo(
    () => knowledgeBases.find((item) => item.id === selectedId) ?? null,
    [knowledgeBases, selectedId],
  );
  const filteredKnowledgeBases = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return knowledgeBases;
    return knowledgeBases.filter((item) => {
      return (
        item.name.toLowerCase().includes(keyword) ||
        (item.description ?? "").toLowerCase().includes(keyword)
      );
    });
  }, [knowledgeBases, query]);

  useEffect(() => {
    let cancelled = false;

    async function loadKnowledgeBases() {
      setLoadingBases(true);
      setError(null);
      try {
        const response = await api.client.fetchKnowledgeBases(listParams);
        const items = normalizeKnowledgeBases(response);
        if (!cancelled) {
          setKnowledgeBases(items);
          setSelectedId((current) => current ?? items[0]?.id ?? null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setKnowledgeBases([]);
          setSelectedId(null);
          setError(loadError instanceof Error ? loadError.message : "知识库加载失败");
        }
      } finally {
        if (!cancelled) setLoadingBases(false);
      }
    }

    void loadKnowledgeBases();

    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (!selectedId) {
      setFiles([]);
      return;
    }

    let cancelled = false;

    const knowledgeBaseId = selectedId;

    async function loadFiles() {
      setLoadingFiles(true);
      setError(null);
      try {
        const response = await api.client.fetchKnowledgeBaseFiles(knowledgeBaseId, { skip: 0, limit: 50 });
        if (!cancelled) setFiles(normalizeKnowledgeBaseFiles(response));
      } catch (loadError) {
        if (!cancelled) {
          setFiles([]);
          setError(loadError instanceof Error ? loadError.message : "知识库文件加载失败");
        }
      } finally {
        if (!cancelled) setLoadingFiles(false);
      }
    }

    void loadFiles();

    return () => {
      cancelled = true;
    };
  }, [api, selectedId]);

  function openCreateForm() {
    setEditingBase(null);
    setFormState(defaultFormState);
    setFormOpen(true);
  }

  function openEditForm(knowledgeBase: KnowledgeBase) {
    setEditingBase(knowledgeBase);
    setFormState({
      name: knowledgeBase.name,
      description: knowledgeBase.description ?? "",
      embeddingModelId: knowledgeBase.embeddingModelId,
    });
    setFormOpen(true);
  }

  async function submitKnowledgeBase() {
    const name = formState.name.trim();
    const embeddingModelId = formState.embeddingModelId.trim();
    if (!name || !embeddingModelId) return;

    const payload: CreateKnowledgeBaseRequest | UpdateKnowledgeBaseRequest = {
      name,
      description: formState.description.trim(),
      embeddingModelId,
    };

    try {
      setError(null);
      if (editingBase) {
        const updated = await api.client.updateKnowledgeBase(editingBase.id, payload);
        setKnowledgeBases((current) =>
          current.map((item) => (item.id === editingBase.id ? { ...item, ...updated } : item)),
        );
      } else {
        const created = await api.client.createKnowledgeBase(payload as CreateKnowledgeBaseRequest);
        setKnowledgeBases((current) => [created, ...current]);
        setSelectedId(created.id);
      }
      setFormOpen(false);
      setEditingBase(null);
      setFormState(defaultFormState);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "知识库保存失败");
    }
  }

  async function confirmDeleteKnowledgeBase() {
    if (!deleteBaseTarget) return;

    try {
      await api.client.deleteKnowledgeBase(deleteBaseTarget.id);
      setKnowledgeBases((current) => current.filter((item) => item.id !== deleteBaseTarget.id));
      setSelectedId((current) => (current === deleteBaseTarget.id ? null : current));
      setDeleteBaseTarget(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "知识库删除失败");
    }
  }

  async function handleUploadFile(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedBase || !selectedFile) return;

    try {
      await api.client.uploadKnowledgeBaseFile(selectedBase.id, selectedFile);
      const response = await api.client.fetchKnowledgeBaseFiles(selectedBase.id, { skip: 0, limit: 50 });
      setFiles(normalizeKnowledgeBaseFiles(response));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "文件上传失败");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function submitFolder() {
    if (!selectedBase) return;
    const name = folderName.trim();
    if (!name) return;

    try {
      const created = await api.client.createKnowledgeBaseFolder(selectedBase.id, {
        folderName: name,
        parentFolderId: null,
      });
      setFiles((current) => [created, ...current]);
      setFolderName("");
      setFolderDialogOpen(false);
    } catch (folderError) {
      setError(folderError instanceof Error ? folderError.message : "文件夹创建失败");
    }
  }

  async function submitRename() {
    if (!selectedBase || !renameTarget) return;
    const newName = renameDraft.trim();
    if (!newName) return;

    try {
      const updated = await api.client.renameKnowledgeBaseFile(selectedBase.id, renameTarget.id, { newName });
      setFiles((current) =>
        current.map((item) =>
          item.id === renameTarget.id ? { ...item, ...updated, displayName: updated.displayName ?? newName } : item,
        ),
      );
      setRenameTarget(null);
      setRenameDraft("");
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "重命名失败");
    }
  }

  async function retryFile(file: KnowledgeBaseFile) {
    if (!selectedBase) return;
    try {
      await api.client.retryKnowledgeBaseFile(selectedBase.id, file.id);
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "重新处理失败");
    }
  }

  async function confirmDeleteFile() {
    if (!selectedBase || !deleteFileTarget) return;

    try {
      await api.client.deleteKnowledgeBaseFile(selectedBase.id, deleteFileTarget.id);
      setFiles((current) => current.filter((item) => item.id !== deleteFileTarget.id));
      setDeleteFileTarget(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "文件删除失败");
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] px-5 pb-5 text-foreground dark:bg-[#1e1f23] dark:text-[#e8e9ed]">
      <WorkspacePageHeader
        title="知识库"
        actions={
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            使用说明
          </Button>
        }
      />

      <div className="mx-auto max-w-[1200px] pt-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative flex-1">
            <span className="sr-only">搜索知识库</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索知识库"
              className="h-9 bg-white pl-9 dark:bg-[#25272b]"
            />
          </label>
          <Button className="h-9 bg-pink-500 px-4 text-white hover:bg-pink-500/90" onClick={openCreateForm}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            新建知识库
          </Button>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        <div className="mt-5 grid min-h-[560px] grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <section className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200 dark:bg-[#25272b] dark:ring-[#34363c]">
            <div className="mb-3 flex items-center justify-between px-2 text-sm font-semibold">
              <span>知识库列表</span>
              <span className="text-xs font-normal text-muted-foreground">{filteredKnowledgeBases.length} 个</span>
            </div>
            {loadingBases ? (
              <div className="grid min-h-[360px] place-items-center">
                <Spinner label="加载知识库" />
              </div>
            ) : filteredKnowledgeBases.length > 0 ? (
              <div className="space-y-2">
                {filteredKnowledgeBases.map((knowledgeBase) => {
                  const active = knowledgeBase.id === selectedId;
                  return (
                    <div
                      key={knowledgeBase.id}
                      className={cn(
                        "group rounded-lg border p-3 transition-colors",
                        active
                          ? "border-pink-200 bg-pink-50/80 dark:border-pink-500/30 dark:bg-pink-500/10"
                          : "border-slate-200 hover:bg-slate-50 dark:border-[#34363c] dark:hover:bg-[#2d2f35]",
                      )}
                    >
                      <button
                        type="button"
                        className="block w-full text-left"
                        onClick={() => setSelectedId(knowledgeBase.id)}
                      >
                        <span className="block truncate text-sm font-semibold">{knowledgeBase.name}</span>
                        <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
                          {knowledgeBase.description || "暂无描述"}
                        </span>
                      </button>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{knowledgeBase.embeddingModelId}</span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            aria-label={`编辑知识库 ${knowledgeBase.name}`}
                            className="rounded p-1 hover:bg-white hover:text-foreground dark:hover:bg-[#25272b]"
                            onClick={() => openEditForm(knowledgeBase)}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={`删除知识库 ${knowledgeBase.name}`}
                            className="rounded p-1 hover:bg-white hover:text-red-500 dark:hover:bg-[#25272b]"
                            onClick={() => setDeleteBaseTarget(knowledgeBase)}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid min-h-[360px] place-items-center">
                <EmptyState description="暂无知识库，点击左上方按钮创建第一个知识库。" className="border-0" />
              </div>
            )}
          </section>

          <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-[#25272b] dark:ring-[#34363c]">
            {selectedBase ? (
              <>
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-[#34363c] md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{selectedBase.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedBase.description || "暂无描述"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={fileInputRef}
                      aria-label="上传文件"
                      type="file"
                      className="sr-only"
                      onChange={(event) => void handleUploadFile(event)}
                    />
                    <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4" aria-hidden="true" />
                      上传文件
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setFolderDialogOpen(true)}>
                      <Folder className="h-4 w-4" aria-hidden="true" />
                      新建文件夹
                    </Button>
                  </div>
                </div>

                {loadingFiles ? (
                  <div className="grid min-h-[360px] place-items-center">
                    <Spinner label="加载文件" />
                  </div>
                ) : files.length > 0 ? (
                  <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-[#34363c]">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs text-muted-foreground dark:bg-[#2d2f35]">
                        <tr>
                          <th className="px-4 py-3 font-medium">名称</th>
                          <th className="px-4 py-3 font-medium">状态</th>
                          <th className="px-4 py-3 font-medium">分块</th>
                          <th className="px-4 py-3 text-right font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-[#34363c]">
                        {files.map((file) => (
                          <tr key={file.id}>
                            <td className="px-4 py-3">
                              <div className="flex min-w-0 items-center gap-2">
                                {file.isDirectory ? (
                                  <Folder className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                                ) : (
                                  <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                                )}
                                <span className="truncate font-medium">{file.displayName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn("rounded-full px-2 py-1 text-xs", statusClassName(file))}>
                                {statusLabel(file)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{file.totalChunks ?? 0}</td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  aria-label={`重命名 ${file.displayName}`}
                                  className="rounded p-1.5 text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#34363c]"
                                  onClick={() => {
                                    setRenameTarget(file);
                                    setRenameDraft(file.displayName);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" aria-hidden="true" />
                                </button>
                                {!file.isDirectory ? (
                                  <button
                                    type="button"
                                    aria-label={`重新处理 ${file.displayName}`}
                                    className="rounded p-1.5 text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#34363c]"
                                    onClick={() => void retryFile(file)}
                                  >
                                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  aria-label={`删除 ${file.displayName}`}
                                  className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                                  onClick={() => setDeleteFileTarget(file)}
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="grid min-h-[360px] place-items-center">
                    <EmptyState description="暂无文件，上传文档或新建文件夹开始构建知识库。" className="border-0" />
                  </div>
                )}
              </>
            ) : (
              <div className="grid min-h-[520px] place-items-center">
                <div className="text-center">
                  <BookOpen className="mx-auto h-12 w-12 text-foreground" aria-hidden="true" />
                  <h2 className="mt-4 text-base font-semibold">暂无知识库</h2>
                  <p className="mt-1 text-sm text-muted-foreground">点击上方按钮创建第一个知识库</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {formOpen ? (
        <KnowledgeBaseFormDialog
          title={editingBase ? "编辑知识库" : "新建知识库"}
          submitLabel={editingBase ? "保存" : "创建"}
          state={formState}
          onStateChange={setFormState}
          onSubmit={() => void submitKnowledgeBase()}
          onClose={() => setFormOpen(false)}
        />
      ) : null}
      {deleteBaseTarget ? (
        <ConfirmDialog
          title="删除知识库"
          description={`确定要删除知识库 “${deleteBaseTarget.name}” 吗？相关文件和向量数据也会被删除。`}
          confirmLabel="确认删除知识库"
          onConfirm={() => void confirmDeleteKnowledgeBase()}
          onClose={() => setDeleteBaseTarget(null)}
        />
      ) : null}
      {folderDialogOpen ? (
        <PromptDialog
          title="新建文件夹"
          label="文件夹名称"
          value={folderName}
          submitLabel="创建文件夹"
          onValueChange={setFolderName}
          onSubmit={() => void submitFolder()}
          onClose={() => setFolderDialogOpen(false)}
        />
      ) : null}
      {renameTarget ? (
        <PromptDialog
          title="重命名"
          label="新名称"
          value={renameDraft}
          submitLabel="保存名称"
          onValueChange={setRenameDraft}
          onSubmit={() => void submitRename()}
          onClose={() => setRenameTarget(null)}
        />
      ) : null}
      {deleteFileTarget ? (
        <ConfirmDialog
          title="删除文件"
          description={`确定要删除 “${deleteFileTarget.displayName}” 吗？`}
          confirmLabel="确认删除文件"
          onConfirm={() => void confirmDeleteFile()}
          onClose={() => setDeleteFileTarget(null)}
        />
      ) : null}
    </div>
  );
}

function KnowledgeBaseFormDialog({
  title,
  submitLabel,
  state,
  onStateChange,
  onSubmit,
  onClose,
}: {
  title: string;
  submitLabel: string;
  state: KnowledgeBaseFormState;
  onStateChange: (state: KnowledgeBaseFormState) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-70 grid place-items-center bg-black/30 px-4">
      <div className="w-full max-w-[520px] rounded-xl bg-white p-5 shadow-xl ring-1 ring-gray-200">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <div className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            知识库名称
            <Input
              value={state.name}
              onChange={(event) => onStateChange({ ...state, name: event.target.value })}
              className="mt-2"
              autoFocus
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            向量模型 ID
            <Input
              value={state.embeddingModelId}
              onChange={(event) => onStateChange({ ...state, embeddingModelId: event.target.value })}
              className="mt-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            描述
            <Textarea
              value={state.description}
              onChange={(event) => onStateChange({ ...state, description: event.target.value })}
              className="mt-2 min-h-20"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button className="bg-pink-500 text-white hover:bg-pink-500/90" onClick={onSubmit}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PromptDialog({
  title,
  label,
  value,
  submitLabel,
  onValueChange,
  onSubmit,
  onClose,
}: {
  title: string;
  label: string;
  value: string;
  submitLabel: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-70 grid place-items-center bg-black/30 px-4">
      <div className="w-full max-w-[420px] rounded-xl bg-white p-5 shadow-xl ring-1 ring-gray-200">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          {label}
          <Input value={value} onChange={(event) => onValueChange(event.target.value)} className="mt-2" autoFocus />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button className="bg-pink-500 text-white hover:bg-pink-500/90" onClick={onSubmit}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-70 grid place-items-center bg-black/30 px-4">
      <div className="w-full max-w-[460px] rounded-xl bg-white p-5 shadow-xl ring-1 ring-gray-200">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-3 text-sm text-slate-600">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button className="bg-red-500 text-white hover:bg-red-600" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function normalizeKnowledgeBases(response: KnowledgeBaseListResponse | KnowledgeBase[] | unknown): KnowledgeBase[] {
  if (Array.isArray(response)) return response as KnowledgeBase[];
  if (response && typeof response === "object" && "items" in response) {
    const items = (response as { items?: unknown }).items;
    if (Array.isArray(items)) return items as KnowledgeBase[];
  }
  return [];
}

function normalizeKnowledgeBaseFiles(
  response: KnowledgeBaseFileListResponse | KnowledgeBaseFile[] | unknown,
): KnowledgeBaseFile[] {
  if (Array.isArray(response)) return response as KnowledgeBaseFile[];
  if (response && typeof response === "object" && "items" in response) {
    const items = (response as { items?: unknown }).items;
    if (Array.isArray(items)) return items as KnowledgeBaseFile[];
  }
  return [];
}

function statusLabel(file: KnowledgeBaseFile) {
  if (file.isDirectory) return "文件夹";
  switch (file.processingStatus) {
    case "pending":
      return "等待处理";
    case "processing":
      return `处理中 ${file.progressPercentage ?? 0}%`;
    case "completed":
      return "已完成";
    case "failed":
      return "处理失败";
    default:
      return file.processingStatus || "未知";
  }
}

function statusClassName(file: KnowledgeBaseFile) {
  if (file.isDirectory) return "bg-amber-50 text-amber-600";
  switch (file.processingStatus) {
    case "completed":
      return "bg-emerald-50 text-emerald-600";
    case "failed":
      return "bg-red-50 text-red-600";
    case "processing":
      return "bg-blue-50 text-blue-600";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export default KnowledgeBasePage;
