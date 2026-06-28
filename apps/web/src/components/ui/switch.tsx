import * as React from "react";
import { cn } from "../../lib/utils";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, ariaLabel, disabled = false, className }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-label={ariaLabel}
      aria-checked={checked}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/30 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-pink-500 bg-pink-500" : "border-slate-300 bg-slate-100 dark:border-[#3b3d44] dark:bg-[#2a2c30]",
        className,
      )}
      onClick={() => onCheckedChange(!checked)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  ),
);

Switch.displayName = "Switch";

export default Switch;
