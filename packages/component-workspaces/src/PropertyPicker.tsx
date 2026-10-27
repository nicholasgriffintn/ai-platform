import { cn, DropdownMenu, DropdownMenuItem } from "@ngriffin_uk/polychat-component-ui";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

export interface PropertyOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-9 grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function PropertyPicker<T extends string>({
  label,
  value,
  options,
  placeholder,
  disabled = false,
  onChange,
}: {
  label: string;
  value: T | null;
  options: readonly PropertyOption<T>[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  const selected = options.find((option) => option.value === value) ?? null;
  const display = (
    <span className="flex min-w-0 items-center gap-2">
      {selected?.icon}
      <span className={cn("truncate", !selected && "text-muted-foreground")}>
        {selected?.label ?? placeholder}
      </span>
    </span>
  );

  if (disabled) {
    return <div className="flex h-8 items-center px-2 text-sm">{display}</div>;
  }

  return (
    <DropdownMenu
      position="bottom"
      className="w-full"
      menuClassName="!left-auto right-0 w-60 max-h-80 overflow-y-auto"
      trigger={display}
      buttonProps={{
        variant: "ghost",
        size: "sm",
        className: "h-8 w-full justify-start px-2 font-normal text-foreground",
        "aria-label": label,
      }}
    >
      {options.map((option) => (
        <DropdownMenuItem
          key={option.value}
          icon={option.icon}
          onClick={() => {
            if (option.value !== value) {
              onChange(option.value);
            }
          }}
        >
          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span className="truncate">{option.label}</span>
            {option.value === value ? <Check size={14} className="shrink-0" /> : null}
          </span>
        </DropdownMenuItem>
      ))}
    </DropdownMenu>
  );
}
