import type { HTMLAttributes, ReactNode } from "react";

import { SidebarBackdrop } from "./SidebarBackdrop";
import { useOverlayDismiss } from "./useOverlayDismiss";
import { cn } from "./utils";

export type SidebarPeekPointerHandlers = Pick<
  HTMLAttributes<HTMLDivElement>,
  "onPointerEnter" | "onPointerLeave" | "onPointerCancel"
>;

interface SidebarShellProps {
  visible: boolean;
  isMobile: boolean;
  peeking?: boolean;
  peekProps?: SidebarPeekPointerHandlers;
  onClose: () => void;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  label?: string;
}

export function SidebarShell({
  visible,
  isMobile,
  peeking = false,
  peekProps,
  onClose,
  header,
  footer,
  children,
  className,
  contentClassName,
  label = "Sidebar",
}: SidebarShellProps) {
  const isDrawer = visible && isMobile;
  const isPeek = peeking && !visible && !isMobile;
  const isShown = visible || isPeek;
  const drawerRef = useOverlayDismiss<HTMLDivElement>({ open: isDrawer, onClose });

  return (
    <>
      {isDrawer && <SidebarBackdrop onClose={onClose} />}

      <div
        ref={drawerRef}
        role={isDrawer ? "dialog" : undefined}
        aria-modal={isDrawer ? true : undefined}
        aria-label={isDrawer ? label : undefined}
        tabIndex={isDrawer ? -1 : undefined}
        {...(isPeek ? peekProps : undefined)}
        className={cn(
          "fixed z-50 h-full w-64 md:relative",
          "bg-sidebar text-sidebar-foreground",
          "polychat-motion-panel transition-transform",
          "border-r border-sidebar-border",
          visible
            ? "translate-x-0"
            : isPeek
              ? "md:absolute md:inset-y-0 md:left-0 md:z-10 md:w-64 md:translate-x-0"
              : "-translate-x-full md:w-0 md:translate-x-0 md:border-0",
          className,
        )}
      >
        {isShown && (
          <div className={cn("flex h-full w-full flex-col", contentClassName)}>
            {header && <div className="sticky top-0 z-10 w-full bg-sidebar">{header}</div>}

            <div className="flex-1 overflow-x-hidden overflow-y-auto">{children}</div>

            {footer && (
              <div className="sticky bottom-0 overflow-visible border-t border-r border-sidebar-border bg-sidebar">
                {footer}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
