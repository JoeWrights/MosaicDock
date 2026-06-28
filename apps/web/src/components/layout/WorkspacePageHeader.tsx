import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { WorkspaceSidebarToggle } from "./WorkspaceSidebarToggle";

interface WorkspacePageHeaderProps {
  title: string;
  actions?: ReactNode;
  className?: string;
}

export function WorkspacePageHeader({ title, actions, className }: WorkspacePageHeaderProps) {
  return (
    <div
      data-testid="workspace-page-header"
      className={cn(
        "flex h-14 items-center justify-between gap-4 text-sm font-semibold text-foreground",
        className,
      )}
    >
      <div data-testid="workspace-page-header-title-row" className="flex items-center gap-3">
        <WorkspaceSidebarToggle />
        <h1 className="text-sm font-semibold">{title}</h1>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

export default WorkspacePageHeader;
