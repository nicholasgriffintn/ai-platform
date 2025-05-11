import React, { useEffect } from "react";
import { cn } from "~/lib/utils";

import { LoginModal } from "~/components/LoginModal";
import { ChatNavbar } from "~/components/Navbar";
import { TurnstileWidget } from "~/components/TurnstileWidget";
import { useExperiments } from "~/hooks/use-experiments";
import { useKeyboardShortcuts } from "~/hooks/useKeyboardShortcuts";
import { useChatStore } from "~/state/stores/chatStore";
import { KeyboardShortcutsHelp } from "../components/KeyboardShortcutsHelp";

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
  const { defineExperiments } = useExperiments();
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: Only run once
  useEffect(() => {
    defineExperiments([
      {
        id: "logo",
        name: "Polychat Logo",
        description: "The logo of the app",
        active: true,
        autoActivate: true,
        targeting: () => true,
        variants: [
          {
            id: "control",
            name: "Default",
            weight: 1,
            activate: () => {},
          },
          {
            id: "minimalist",
            name: "Minimalist",
            weight: 1,
            activate: () => {},
          },
          {
            id: "tropical",
            name: "Tropical",
            weight: 1,
            activate: () => {},
          },
          {
            id: "abstract",
            name: "Abstract",
            weight: 1,
            activate: () => {},
          },
        ],
      },
    ]);
  }, []);

  return (
    <>
      <div
        className={cn(
          "flex h-dvh w-full max-w-full overflow-hidden",
          bgClassName ?? "bg-off-white dark:bg-zinc-900",
        )}
      >
        <div className="flex flex-row w-full overflow-hidden relative">
          {sidebarContent && (
            <div className="pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
              {enhancedSidebarContent}
            </div>
          )}

          <div className="flex flex-col min-w-0 flex-1 h-full pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)]">
            {displayNavBar && (
              <ChatNavbar
                showSidebarToggle={showSidebarToggleInNavbar && !sidebarVisible}
              />
            )}
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
        <div className="fixed bottom-0 right-0 z-10">
          <TurnstileWidget />
        </div>
      </div>

      <KeyboardShortcutsHelp
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />
    </>
  );
}
