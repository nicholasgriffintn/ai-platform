import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

interface SidebarShellProps {
  /** Whether the sidebar is visible */
  visible: boolean;
  /** Whether this is a mobile viewport */
  isMobile: boolean;
  /** Callback to close/hide the sidebar */
  onClose: () => void;
  /** Content to render in the sidebar header */
  header?: ReactNode;
  /** Content to render in the sidebar footer */
  footer?: ReactNode;
  /** Main sidebar content */
  children: ReactNode;
  /** Custom className for the sidebar container */
  className?: string;
  /** Custom className for the content wrapper */
  contentClassName?: string;
}

export function SidebarShell({
  visible,
  isMobile,
  onClose,
  header,
  footer,
  children,
  className,
  contentClassName,
}: SidebarShellProps) {
  return (
    <>
      {visible && isMobile && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-20"
          onClick={onClose}
          onKeyDown={(e) => e.key === "Enter" && onClose()}
          aria-hidden="true"
        />
      )}

      <div
        className={cn(
          "fixed md:relative z-50 h-full w-64",
          "bg-off-white dark:bg-zinc-900",
          "transition-transform duration-300 ease-in-out",
          "border-r border-zinc-200 dark:border-zinc-800",
          visible
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0 md:w-0 md:border-0",
          className,
        )}
      >
        {visible && (
          <div
            className={cn(
              "flex flex-col h-full w-64 overflow-hidden",
              contentClassName,
            )}
          >
            {header && (
              <div className="sticky top-0 bg-off-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 z-10 w-full">
                {header}
              </div>
            )}

            <div className="flex-1 overflow-y-auto">{children}</div>

            {footer && (
              <div className="sticky bottom-0 border-t border-zinc-200 dark:border-zinc-800 bg-off-white dark:bg-zinc-900">
                {footer}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
