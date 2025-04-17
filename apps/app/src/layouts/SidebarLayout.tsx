import React from "react";

import { LoginModal } from "~/components/LoginModal";
import { ChatNavbar } from "~/components/Navbar";
import { TurnstileWidget } from "~/components/TurnstileWidget";
import { useKeyboardShortcuts } from "~/hooks/useKeyboardShortcuts";
import { useChatStore } from "~/state/stores/chatStore";
import { KeyboardShortcutsHelp } from "../components/KeyboardShortcutsHelp";

interface SidebarLayoutProps {
  children: React.ReactNode;
  sidebarContent: React.ReactNode;
  showSidebarToggleInNavbar?: boolean;
}

export function SidebarLayout({
  children,
  sidebarContent,
  showSidebarToggleInNavbar = true,
}: SidebarLayoutProps) {
  const {
    sidebarVisible,
    showKeyboardShortcuts,
    setShowKeyboardShortcuts,
    showLoginModal,
    setShowLoginModal,
  } = useChatStore();
  useKeyboardShortcuts();

  const handleEnterApiKey = () => {
    setShowLoginModal(true);
  };

  const enhancedSidebarContent = React.isValidElement(sidebarContent)
    ? React.cloneElement(sidebarContent as React.ReactElement<any>, {
        onEnterApiKey: handleEnterApiKey,
      })
    : sidebarContent;

  return (
    <>
      <div className="flex h-dvh w-full max-w-full overflow-hidden bg-off-white dark:bg-zinc-900">
        <div className="flex flex-row w-full overflow-hidden relative">
          {sidebarContent && enhancedSidebarContent}

          <div className="flex flex-col min-w-0 flex-1 h-full">
            <ChatNavbar
              showSidebarToggle={showSidebarToggleInNavbar && !sidebarVisible}
            />
            <div className="flex-1 overflow-auto w-full">
              {children}
              <LoginModal
                open={showLoginModal}
                onOpenChange={setShowLoginModal}
                onKeySubmit={() => setShowLoginModal(false)}
              />
            </div>
          </div>
        </div>
        <TurnstileWidget />
      </div>

      <KeyboardShortcutsHelp
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />
    </>
  );
}
