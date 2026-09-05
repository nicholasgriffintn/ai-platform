import { cn } from "@ngriffin_uk/polychat-component-ui";
import React, { Suspense, lazy } from "react";

import { ChatNavbar } from "~/components/Navbar";
import { SearchDialog } from "~/components/Search/SearchDialog";
import { useKeyboardShortcuts } from "~/hooks/useKeyboardShortcuts";
import { APP_KEYBOARD_SHORTCUT_SECTIONS } from "~/lib/keyboard-shortcuts";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";

export const MAIN_CONTENT_ID = "main-content";

const LoginModal = lazy(() =>
  import("~/components/Models/LoginModal").then((mod) => ({
    default: mod.LoginModal,
  })),
);

const KeyboardShortcutsHelp = lazy(() =>
  import("@ngriffin_uk/polychat-component-conversation").then((mod) => ({
    default: mod.KeyboardShortcutsHelp,
  })),
);

interface SidebarLayoutProps {
  children: React.ReactNode;
  sidebarContent: React.ReactNode;
  showSidebarToggleInNavbar?: boolean;
  displayNavBar?: boolean;
  bgClassName?: string;
}

export function SidebarLayout({
  children,
  sidebarContent,
  showSidebarToggleInNavbar = true,
  displayNavBar = true,
  bgClassName,
}: SidebarLayoutProps) {
  const {
    sidebarVisible,
    showKeyboardShortcuts,
    setShowKeyboardShortcuts,
    showLoginModal,
    setShowLoginModal,
  } = useUIStore();
  const showSearch = useChatStore((state) => state.showSearch);
  const setShowSearch = useChatStore((state) => state.setShowSearch);

  useKeyboardShortcuts();

  const handleEnterApiKey = () => {
    setShowLoginModal(true);
  };

  const enhancedSidebarContent = React.isValidElement<{ onEnterApiKey?: () => void }>(
    sidebarContent,
  )
    ? React.cloneElement(sidebarContent, {
        onEnterApiKey: handleEnterApiKey,
      })
    : sidebarContent;

  return (
    <>
      <div
        className={cn(
          "flex h-dvh w-full max-w-full overflow-hidden",
          bgClassName ?? "bg-background",
        )}
      >
        <a
          href={`#${MAIN_CONTENT_ID}`}
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-md focus:bg-popover focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-popover-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to main content
        </a>

        <div className="flex flex-row w-full overflow-hidden relative">
          {sidebarContent && (
            <div className="pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
              {enhancedSidebarContent}
            </div>
          )}

          <div className="flex flex-col min-w-0 flex-1 h-full pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)]">
            {displayNavBar && (
              <ChatNavbar showSidebarToggle={showSidebarToggleInNavbar && !sidebarVisible} />
            )}
            <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 overflow-auto w-full">
              {children}
              {showLoginModal && (
                <Suspense fallback={null}>
                  <LoginModal
                    open={showLoginModal}
                    onOpenChange={setShowLoginModal}
                    onKeySubmit={() => setShowLoginModal(false)}
                  />
                </Suspense>
              )}
            </main>
          </div>
        </div>
      </div>

      {showKeyboardShortcuts && (
        <Suspense fallback={null}>
          <KeyboardShortcutsHelp
            isOpen={showKeyboardShortcuts}
            onClose={() => setShowKeyboardShortcuts(false)}
            sections={APP_KEYBOARD_SHORTCUT_SECTIONS}
          />
        </Suspense>
      )}
      {showSearch && <SearchDialog isOpen onClose={() => setShowSearch(false)} />}
    </>
  );
}
