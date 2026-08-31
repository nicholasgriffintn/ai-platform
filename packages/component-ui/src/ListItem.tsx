import type { ReactNode } from "react";

import { cn } from "./utils";

interface ListItemProps {
  /** Whether this item is currently active/selected */
  isActive?: boolean;
  /** Icon to display before the label */
  icon?: ReactNode;
  /** Badge or indicator to display (e.g., "Local only", branch icon) */
  badge?: ReactNode;
  /** Main label text */
  label: ReactNode;
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
  const containerClassName = cn(
    "group flex items-center relative p-2 rounded-lg transition-colors",
    isActive
      ? "bg-off-white-highlight text-black dark:bg-[#2D2D2D] dark:text-white"
      : "hover:bg-zinc-200 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300",
    onClick ? "cursor-pointer" : "cursor-default",
    className,
  );
  const labelClassName = "whitespace-nowrap overflow-hidden text-ellipsis block";

  return (
    <li
      data-id={dataId}
      className={containerClassName}
      aria-current={isActive && !onClick ? "page" : undefined}
    >
      <div
        className={cn(
          "overflow-hidden pr-1 transition-all duration-200 flex items-center",
          actions
            ? "md:w-full md:group-hover:w-[calc(100%-60px)] md:group-focus-within:w-[calc(100%-60px)] w-[calc(100%-60px)]"
            : "w-full",
        )}
      >
        {icon && <span className="mr-2 flex-shrink-0">{icon}</span>}
        {badge && <span className="relative z-10 mr-2 flex-shrink-0">{badge}</span>}
        <div className="flex-1 min-w-0">
          {onClick ? (
            <button
              type="button"
              aria-current={isActive ? "page" : undefined}
              className={cn(
                labelClassName,
                "w-full text-left cursor-pointer",
                "after:absolute after:inset-0 after:content-['']",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 focus:outline-none",
              )}
              onClick={onClick}
            >
              {label}
            </button>
          ) : (
            <span className={labelClassName}>{label}</span>
          )}
          {sublabel && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap overflow-hidden text-ellipsis block">
              {sublabel}
            </span>
          )}
        </div>
      </div>
      {actions}
    </li>
  );
}
