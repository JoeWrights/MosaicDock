import { useEffect, type ReactNode } from "react";
import { Select, type SelectOption } from "../../components/ui/select";
import { cn } from "../../lib/utils";

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-[#e8e9ed]">{title}</h3>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-[#2e3035] dark:bg-[#232428]">
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  title,
  description,
  children,
  bordered = true,
  className,
}: {
  title: string;
  description: ReactNode;
  children?: ReactNode;
  bordered?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-3.5",
        bordered && "border-b border-gray-100 dark:border-[#2e3035]",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-base text-gray-900 dark:text-[#e8e9ed]">{title}</span>
        <span className="text-xs text-gray-500 dark:text-[#8b8d95]">{description}</span>
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}

export function SettingsSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        checked ? "bg-pink-500" : "bg-slate-200 dark:bg-[#3a3c40]",
      )}
      onClick={() => onChange(!checked)}
    >
      <span
        className={cn(
          "h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function SettingsTextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-9 w-full rounded-md border border-pink-100 bg-pink-50/40 px-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-pink-300 dark:border-[#34363c] dark:bg-[#1e1f23]",
        props.className,
      )}
    />
  );
}

export function SettingsSelect({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label: string;
  className?: string;
}) {
  return (
    <Select
      ariaLabel={label}
      value={value}
      options={options}
      onValueChange={onChange}
      className={className}
    />
  );
}

export function SettingsSlider({
  value,
  min,
  max,
  unit = "%",
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  unit?: string;
  label: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex w-48 items-center gap-3">
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="flex-1 accent-pink-500"
      />
      <span className="w-10 text-right text-sm text-gray-600 dark:text-[#8b8d95]">
        {value}
        {unit}
      </span>
    </div>
  );
}

export function SettingsToast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 3000);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div
      role="status"
      className="fixed left-1/2 top-4 z-60 -translate-x-1/2 rounded-md bg-green-50 px-4 py-2 text-sm text-green-700 shadow-sm dark:bg-green-500/10 dark:text-green-300"
    >
      {message}
    </div>
  );
}
