import type { ReactNode } from "react";

import { SidebarBackdrop } from "./SidebarBackdrop";
import { useOverlayDismiss } from "./useOverlayDismiss";
import { cn } from "./utils";

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
  /** Names the drawer for screen readers while it overlays the page */
  label?: string;
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
  label = "Sidebar",
}: SidebarShellProps) {
  // Only the mobile drawer overlays the page, so only it takes focus and Escape.
  const isDrawer = visible && isMobile;
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
        className={cn(
          "fixed md:relative z-50 h-full w-64",
          "bg-sidebar text-sidebar-foreground",
          "polychat-motion-panel transition-transform",
          "border-sidebar-border border-r",
          visible ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:w-0 md:border-0",
          className,
        )}
      >
        {visible && (
          <div className={cn("flex h-full w-full flex-col", contentClassName)}>
            {header && <div className="bg-sidebar sticky top-0 z-10 w-full">{header}</div>}

            <div className="flex-1 overflow-y-auto overflow-x-hidden">{children}</div>

            {footer && (
              <div className="border-sidebar-border bg-sidebar sticky bottom-0 overflow-visible border-t border-r">
                {footer}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
