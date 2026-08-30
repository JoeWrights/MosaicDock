import { PanelLeft } from "lucide-react";
import { useWorkspaceSidebar } from "../../layouts/WorkspaceLayout";
import { cn } from "../../lib/utils";

interface WorkspaceSidebarToggleProps {
  className?: string;
}

export function WorkspaceSidebarToggle({ className }: WorkspaceSidebarToggleProps) {
  const { sidebarOpen, toggleSidebar } = useWorkspaceSidebar();
  const label = sidebarOpen ? "收起侧边栏" : "展开侧边栏";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "rounded-lg p-1 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground dark:hover:bg-[#2a2c30]",
        className,
      )}
      onClick={toggleSidebar}
    >
      <PanelLeft className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export default WorkspaceSidebarToggle;
