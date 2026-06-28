import { Inbox } from "lucide-react";
import { cn } from "../../lib/utils";

interface EmptyStateProps {
  description: string;
  className?: string;
}

export function EmptyState({ description, className }: EmptyStateProps) {
  return (
    <div className={cn("grid place-items-center rounded-lg border border-dashed p-8 text-center", className)}>
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Inbox className="h-8 w-8" aria-hidden="true" />
        <p className="text-sm">{description}</p>
      </div>
    </div>
  );
}
