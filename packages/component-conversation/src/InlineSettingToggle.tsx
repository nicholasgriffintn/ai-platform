import { cn, ShortcutTooltip } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

export interface InlineSettingToggleProps {
  id: string;
  label: string;
  icon: ReactNode;
  isOn: boolean;
  isDisabled?: boolean;
  description: string;
  shortcut?: string;
  onChange: (isOn: boolean) => void;
}

export function InlineSettingToggle({
  id,
  label,
  icon,
  isOn,
  isDisabled = false,
  description,
  shortcut,
  onChange,
}: InlineSettingToggleProps) {
  return (
    <ShortcutTooltip keys={shortcut ? [shortcut] : []} label={description}>
      <button
        id={id}
        type="button"
        disabled={isDisabled}
        aria-pressed={isOn}
        aria-label={label}
        className={cn(
          "polychat-motion-micro inline-flex h-8 min-w-8 items-center gap-1.5 rounded-md px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          isOn
            ? "bg-active-work/15 text-active-work"
            : "text-muted-foreground hover:bg-selection hover:text-foreground",
        )}
        onClick={() => onChange(!isOn)}
      >
        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center" aria-hidden="true">
          {icon}
        </span>
        <span className="hidden max-w-[130px] truncate @2xl/composer-footer:inline">{label}</span>
      </button>
    </ShortcutTooltip>
  );
}
