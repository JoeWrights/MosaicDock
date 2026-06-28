import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value: string;
  options: SelectOption[];
  onValueChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function Select({
  value,
  options,
  onValueChange,
  ariaLabel,
  placeholder = "请选择",
  className,
  disabled = false,
}: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const [floatingStyle, setFloatingStyle] = React.useState<React.CSSProperties>({});
  const rootRef = React.useRef<HTMLDivElement>(null);
  const floatingRef = React.useRef<HTMLDivElement>(null);
  const listboxId = React.useId();
  const selectedOption = options.find((option) => option.value === value);

  const updateFloatingPosition = React.useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;

    setFloatingStyle({
      left: rect.left,
      top: rect.bottom + 8,
      width: rect.width,
    });
  }, []);

  React.useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !floatingRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  React.useEffect(() => {
    if (!open) return;

    updateFloatingPosition();

    window.addEventListener("resize", updateFloatingPosition);
    window.addEventListener("scroll", updateFloatingPosition, true);
    return () => {
      window.removeEventListener("resize", updateFloatingPosition);
      window.removeEventListener("scroll", updateFloatingPosition, true);
    };
  }, [open, updateFloatingPosition]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-controls={listboxId}
        aria-expanded={open}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-left text-sm transition-colors",
          "focus-visible:border-pink-500 focus-visible:outline-none focus-visible:ring-0",
          disabled ? "cursor-not-allowed opacity-50" : "hover:border-slate-300 dark:hover:border-[#42454c]",
        )}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <span className={cn("truncate", selectedOption ? "text-foreground" : "text-muted-foreground")}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open ? "rotate-180" : "")}
          aria-hidden="true"
        />
      </button>

      {open
        ? createPortal(
            <div
              ref={floatingRef}
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel}
              className="fixed z-100 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-[#2f3136] dark:bg-[#232428]"
              style={floatingStyle}
            >
              {options.map((option) => {
                const selected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={option.disabled}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      selected
                        ? "bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-300"
                        : "text-foreground hover:bg-slate-100 dark:hover:bg-[#2a2c30]",
                      option.disabled ? "cursor-not-allowed opacity-50" : "",
                    )}
                    onClick={() => {
                      if (option.disabled) return;
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{option.label}</span>
                    {selected ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export default Select;
