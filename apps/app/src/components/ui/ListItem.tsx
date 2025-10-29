import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

interface ListItemProps {
  /** Whether this item is currently active/selected */
  isActive?: boolean;
  /** Icon to display before the label */
  icon?: ReactNode;
  /** Badge or indicator to display (e.g., "Local only", branch icon) */
  badge?: ReactNode;
  /** Main label text */
  label: string;
  /** Optional sublabel/description text */
  sublabel?: string;
  /** Actions to show on hover (use HoverActions component) */
  actions?: ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Custom className */
  className?: string;
  /** Additional data attributes */
  "data-id"?: string;
}

export function ListItem({
  isActive,
  icon,
  badge,
  label,
  sublabel,
  actions,
  onClick,
  className,
  "data-id": dataId,
}: ListItemProps) {
  return (
    <div
      data-id={dataId}
      className={cn(
        "group flex items-center relative p-2 rounded-lg cursor-pointer transition-colors",
        isActive
          ? "bg-off-white-highlight text-black dark:bg-[#2D2D2D] dark:text-white"
          : "hover:bg-zinc-200 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300",
        className,
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          onClick();
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div
        className={cn(
          "overflow-hidden pr-1 transition-all duration-200 flex items-center",
          actions
            ? "md:w-full md:group-hover:w-[calc(100%-60px)] w-[calc(100%-60px)]"
            : "w-full",
        )}
      >
        {icon && <span className="mr-2 flex-shrink-0">{icon}</span>}
        {badge && <span className="mr-2 flex-shrink-0">{badge}</span>}
        <div className="flex-1 min-w-0">
          <span className="whitespace-nowrap overflow-hidden text-ellipsis block">
            {label}
          </span>
          {sublabel && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap overflow-hidden text-ellipsis block">
              {sublabel}
            </span>
          )}
        </div>
      </div>
      {actions}
    </div>
  );
}
