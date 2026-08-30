import { Boxes } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SkillOption {
  id: string;
  name?: string;
  description?: string;
  manifest?: {
    name?: string;
    description?: string;
  };
}

interface SkillPickerPanelProps {
  skills: SkillOption[];
  open: boolean;
  query: string;
  selectedIndex: number;
  onHover: (index: number) => void;
  onSelect: (skill: SkillOption) => void;
}

export function SkillPickerPanel({
  skills,
  open,
  query,
  selectedIndex,
  onHover,
  onSelect,
}: SkillPickerPanelProps) {
  if (!open) return null;

  const filteredSkills = filterSkills(skills, query);

  return (
    <div className="absolute bottom-full left-0 z-20 mb-2 w-full overflow-hidden rounded-lg bg-white shadow-[0_12px_32px_rgba(0,0,0,0.15),0_4px_8px_rgba(0,0,0,0.1)] ring-1 ring-gray-200 dark:bg-[#232428] dark:ring-[#2e3035]">
      {filteredSkills.length > 0 ? (
        <div role="listbox" aria-label="技能选择" className="max-h-44 overflow-y-auto py-1">
          {filteredSkills.map((skill, index) => {
            const active = index === selectedIndex;
            const name = getSkillName(skill);
            return (
              <button
                key={skill.id}
                type="button"
                role="option"
                aria-selected={active}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors",
                  active ? "bg-pink-50 dark:bg-pink-500/10" : "hover:bg-gray-50 dark:hover:bg-[#2a2c30]",
                )}
                onMouseEnter={() => onHover(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(skill)}
              >
                <Boxes className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                <span className="min-w-0 flex items-center gap-2">
                  <span className={cn("whitespace-nowrap text-sm font-semibold", active && "text-pink-500")}>
                    {name}
                  </span>
                  <span className="truncate text-xs text-slate-500">{getSkillDescription(skill)}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="py-4 text-center text-sm text-slate-400">未找到匹配的技能</div>
      )}
    </div>
  );
}

export function normalizeSkills(response: unknown): SkillOption[] {
  const items = Array.isArray(response)
    ? response
    : (response as { items?: unknown[] } | null)?.items;

  if (!Array.isArray(items)) return [];

  return items.filter((item): item is SkillOption => {
    return (
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      typeof (item as { id: unknown }).id === "string"
    );
  });
}

export function filterSkills(skills: SkillOption[], query: string): SkillOption[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return skills;

  return skills.filter((skill) => {
    const name = getSkillName(skill).toLowerCase();
    const description = getSkillDescription(skill).toLowerCase();
    return name.includes(normalizedQuery) || description.includes(normalizedQuery);
  });
}

export function getSkillName(skill: SkillOption): string {
  return skill.manifest?.name ?? skill.name ?? skill.id;
}

export function getSkillDescription(skill: SkillOption): string {
  return skill.manifest?.description ?? skill.description ?? "";
}

export function findSkillTrigger(text: string, cursorPosition: number): { start: number; query: string } | null {
  const textBeforeCursor = text.slice(0, cursorPosition);
  const slashIndex = textBeforeCursor.lastIndexOf("/");
  if (slashIndex < 0) return null;

  const charBeforeSlash = textBeforeCursor[slashIndex - 1];
  if (slashIndex > 0 && charBeforeSlash !== " " && charBeforeSlash !== "\n") return null;

  const query = textBeforeCursor.slice(slashIndex + 1);
  if (/\s/.test(query)) return null;

  return { start: slashIndex, query };
}

export function serializeSkillMentions(text: string, skills: SkillOption[]): string {
  if (skills.length === 0) return text;

  const skillNames = new Set(skills.map(getSkillName));
  return text.replace(/(^|\s)\/([A-Za-z0-9._-]+)(?=\s|$)/g, (match, prefix: string, name: string) => {
    if (!skillNames.has(name)) return match;
    return `${prefix}<skill:${name}>`;
  });
}
