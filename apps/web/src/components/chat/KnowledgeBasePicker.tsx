import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import type { KnowledgeBase } from "@mosaic-dock/shared";
import { cn } from "../../lib/utils";

interface SelectedKnowledgeBaseTagsProps {
  knowledgeBases: KnowledgeBase[];
  selectedIds: string[];
  onRemove: (knowledgeBaseId: string) => void;
}

interface KnowledgeBasePickerPanelProps {
  knowledgeBases: KnowledgeBase[];
  open: boolean;
  selectedIds: string[];
  onToggle: (knowledgeBaseId: string) => void;
}

export function SelectedKnowledgeBaseTags({
  knowledgeBases,
  selectedIds,
  onRemove,
}: SelectedKnowledgeBaseTagsProps) {
  const selectedKnowledgeBases = selectedIds
    .map((id) => knowledgeBases.find((knowledgeBase) => knowledgeBase.id === id))
    .filter((knowledgeBase): knowledgeBase is KnowledgeBase => Boolean(knowledgeBase));

  if (selectedKnowledgeBases.length === 0) return null;

  return (
    <div className="mb-1.5 flex flex-wrap gap-2 px-1.5">
      {selectedKnowledgeBases.map((knowledgeBase) => (
        <button
          key={knowledgeBase.id}
          type="button"
          aria-label={`移除知识库 ${knowledgeBase.name}`}
          className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-200 dark:bg-[#2a2c30] dark:text-slate-300 dark:hover:bg-[#34363c]"
          onClick={() => onRemove(knowledgeBase.id)}
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{knowledgeBase.name}</span>
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export function KnowledgeBasePickerPanel({
  knowledgeBases,
  open,
  selectedIds,
  onToggle,
}: KnowledgeBasePickerPanelProps) {
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    if (open) {
      setSearchText("");
    }
  }, [open]);

  if (!open) return null;

  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredKnowledgeBases = normalizedSearch
    ? knowledgeBases.filter((knowledgeBase) => {
        const name = knowledgeBase.name.toLowerCase();
        const description = knowledgeBase.description?.toLowerCase() ?? "";
        return name.includes(normalizedSearch) || description.includes(normalizedSearch);
      })
    : knowledgeBases;

  return (
    <div className="absolute bottom-9 left-0 z-20 w-80 rounded-lg bg-white p-4 shadow-[0_12px_32px_rgba(0,0,0,0.15),0_4px_8px_rgba(0,0,0,0.1)] ring-1 ring-gray-200 dark:bg-[#232428] dark:ring-[#2e3035]">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="搜索知识库..."
          className="h-8 w-full rounded border border-gray-200 bg-white pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-gray-300 dark:border-[#34363c] dark:bg-[#1e1f23]"
        />
      </label>
      <div className="mt-3 max-h-80 overflow-y-auto pr-1">
        {filteredKnowledgeBases.length > 0 ? (
          <div className="space-y-1">
            {filteredKnowledgeBases.map((knowledgeBase) => {
              const selected = selectedIds.includes(knowledgeBase.id);
              return (
                <button
                  key={knowledgeBase.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded p-2 text-left transition-colors",
                    selected ? "bg-pink-50 dark:bg-pink-500/10" : "hover:bg-gray-50 dark:hover:bg-[#2a2c30]",
                  )}
                  onClick={() => onToggle(knowledgeBase.id)}
                >
                  <span
                    className={cn(
                      "grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px]",
                      selected
                        ? "border-pink-500 bg-pink-500 text-white"
                        : "border-slate-300 text-transparent dark:border-slate-600",
                    )}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {knowledgeBase.name}
                    </span>
                    {knowledgeBase.description ? (
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        {knowledgeBase.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400">
            <Search className="mx-auto mb-2 h-10 w-10" aria-hidden="true" />
            <p className="text-sm">未找到匹配的知识库</p>
          </div>
        )}
      </div>
    </div>
  );
}
