import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}

export const EmptyState = ({
  icon,
  title,
  message,
  action,
  className,
}: EmptyStateProps) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        "bg-off-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-8",
        className,
      )}
    >
      {icon && (
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-700 mb-4">
          {icon}
        </div>
      )}
      {title && (
        <h3 className="text-xl font-semibold mb-2 text-zinc-800 dark:text-zinc-200">
          {title}
        </h3>
      )}
      {message && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 max-w-sm mx-auto">
          {message}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};
