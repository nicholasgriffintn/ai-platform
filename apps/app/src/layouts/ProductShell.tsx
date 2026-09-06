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

const NewProjectConversationDialog = lazy(() =>
  import("~/components/Work/NewProjectConversationDialog").then((mod) => ({
    default: mod.NewProjectConversationDialog,
  })),
);

const MetaAssistantOverlay = lazy(() =>
  import("~/components/MetaAssistant/MetaAssistantOverlay").then((mod) => ({
    default: mod.MetaAssistantOverlay,
  })),
);

interface ProductShellProps {
  children: React.ReactNode;
  sidebarContent: React.ReactNode;
  showSidebarToggleInNavbar?: boolean;
  displayNavBar?: boolean;
  bgClassName?: string;
}

export function ProductShell({
  children,
  sidebarContent,
  showSidebarToggleInNavbar = true,
  displayNavBar = true,
  bgClassName,
}: ProductShellProps) {
  const {
    sidebarVisible,
    showKeyboardShortcuts,
    setShowKeyboardShortcuts,
    showLoginModal,
    setShowLoginModal,
    showMetaAssistant,
    setShowMetaAssistant,
    showProjectPicker,
    setShowProjectPicker,
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

        <div className="relative flex min-h-0 w-full flex-1 flex-row overflow-hidden">
          {sidebarContent && (
            <div className="pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
              {enhancedSidebarContent}
            </div>
          )}

          <div className="flex h-full min-w-0 flex-1 flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)]">
            {displayNavBar && (
              <ChatNavbar showSidebarToggle={showSidebarToggleInNavbar && !sidebarVisible} />
            )}
            <main id={MAIN_CONTENT_ID} tabIndex={-1} className="w-full flex-1 overflow-auto">
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
      {showMetaAssistant && (
        <Suspense fallback={null}>
          <MetaAssistantOverlay open onClose={() => setShowMetaAssistant(false)} />
        </Suspense>
      )}
      {showProjectPicker && (
        <Suspense fallback={null}>
          <NewProjectConversationDialog open onOpenChange={setShowProjectPicker} />
        </Suspense>
      )}
    </>
  );
}
