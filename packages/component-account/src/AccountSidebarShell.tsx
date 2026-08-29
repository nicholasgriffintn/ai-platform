import {
  Button,
  cn,
  Link,
  SidebarBackdrop,
  useOverlayDismiss,
} from "@ngriffin_uk/polychat-component-ui";
import { Home, Loader2, LogOut } from "lucide-react";
import type { ReactNode } from "react";

import { AccountNavigation, type AccountSection } from "./AccountNavigation";

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
        className={`fixed md:relative z-50 h-full w-64 bg-off-white dark:bg-zinc-900 transition-transform duration-300 ease-in-out border-r border-zinc-200 dark:border-zinc-800 ${
          sidebarVisible ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:w-0 md:border-0"
        }`}
      >
        {sidebarVisible && (
          <div className="flex flex-col h-full w-64">
            <div className="sticky top-0 bg-off-white dark:bg-zinc-900 border-b border-r border-zinc-200 dark:border-zinc-800 z-10 w-full">
              {header}
            </div>
            <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 pb-[50px]">
              <ul className="space-y-1">
                <li>
                  <Link
                    href={homeHref}
                    className={cn(
                      "block w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out",
                      "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
                      "dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                      "no-underline",
                      "flex items-center",
                    )}
                  >
                    <Home className="mr-2 h-5 w-5 flex-shrink-0" />
                    <span>Back to Home</span>
                  </Link>
                </li>
                <li>
                  <AccountNavigation
                    sections={sections}
                    activeSectionId={activeSectionId}
                    onSelect={(section) => onSelectSection(section.id)}
                  />
                </li>
                {isAuthenticated && (
                  <li>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={onLogout}
                      disabled={isLoggingOut}
                      className="w-full"
                      icon={
                        isLoggingOut ? (
                          <Loader2 className="mr-2 h-5 w-5 animate-spin flex-shrink-0" />
                        ) : (
                          <LogOut className="mr-2 h-5 w-5 flex-shrink-0" />
                        )
                      }
                    >
                      <span>Logout</span>
                    </Button>
                  </li>
                )}
              </ul>
            </nav>
            <div className="sticky bottom-0 border-t border-r border-zinc-200 dark:border-zinc-800 bg-off-white dark:bg-zinc-900 overflow-visible">
              {footer}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
