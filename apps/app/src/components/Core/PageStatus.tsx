import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

interface PageStatusProps {
  icon?: ReactNode;
  title?: string;
  message?: string;
  children?: ReactNode;
  className?: string;
}

export const PageStatus = ({
  icon,
  title,
  message,
  children,
  className,
}: PageStatusProps) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center gap-4 p-4",
        "h-[calc(100vh-10rem)]",
        className,
      )}
    >
      {icon && <div className="text-zinc-500 dark:text-zinc-400">{icon}</div>}
      {title && (
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
          {title}
        </h2>
      )}
      {message && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md">
          {message}
        </p>
      )}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
};
