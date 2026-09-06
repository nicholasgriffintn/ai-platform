import { cn, Link, SidebarBackdrop, useOverlayDismiss } from "@ngriffin_uk/polychat-component-ui";
import { Home, Loader2, LogOut } from "lucide-react";
import type { ReactNode } from "react";

import { AccountNavigation, type AccountSection } from "./AccountNavigation";

const accountSidebarRowClass =
  "text-muted-foreground hover:text-foreground flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm transition-colors";

export interface AccountSidebarShellProps {
  sections: AccountSection[];
  activeSectionId: string;
  onSelectSection: (sectionId: string) => void;
  homeHref: string;
  header?: ReactNode;
  footer?: ReactNode;
  isMobile: boolean;
  sidebarVisible: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  isLoggingOut?: boolean;
  onLogout: () => void;
}

export function AccountSidebarShell({
  sections,
  activeSectionId,
  onSelectSection,
  homeHref,
  header,
  footer,
  isMobile,
  sidebarVisible,
  onClose,
  isAuthenticated,
  isLoggingOut = false,
  onLogout,
}: AccountSidebarShellProps) {
  // Only the mobile drawer overlays the page, so only it takes focus and Escape.
  const isDrawer = sidebarVisible && isMobile;
  const drawerRef = useOverlayDismiss<HTMLDivElement>({ open: isDrawer, onClose });

  return (
    <>
      {isDrawer && <SidebarBackdrop onClose={onClose} label="Close account navigation" />}
      <div
        ref={drawerRef}
        role={isDrawer ? "dialog" : undefined}
        aria-modal={isDrawer ? true : undefined}
        aria-label={isDrawer ? "Account navigation" : undefined}
        tabIndex={isDrawer ? -1 : undefined}
        className={`bg-surface border-border fixed z-50 h-full w-64 border-r transition-transform duration-300 ease-in-out md:relative ${
          sidebarVisible ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:w-0 md:border-0"
        }`}
      >
        {sidebarVisible && (
          <div className="flex flex-col h-full w-64">
            <div className="bg-surface border-border sticky top-0 z-10 w-full border-r border-b">
              {header}
            </div>
            <nav className="flex flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-2 pt-2 pb-[50px]">
              <Link href={homeHref} className={cn(accountSidebarRowClass, "no-underline")}>
                <Home className="h-4 w-4 flex-shrink-0" />
                <span className="min-w-0 flex-1 truncate">Back to Home</span>
              </Link>
              <AccountNavigation
                sections={sections}
                activeSectionId={activeSectionId}
                onSelect={(section) => onSelectSection(section.id)}
              />
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={onLogout}
                  disabled={isLoggingOut}
                  className={cn(
                    accountSidebarRowClass,
                    "hover:text-failure mt-auto disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  {isLoggingOut ? (
                    <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate">Logout</span>
                </button>
              )}
            </nav>
            <div className="border-border bg-surface sticky bottom-0 overflow-visible border-t border-r">
              {footer}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
