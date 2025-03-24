import { useState } from "react";

import { LoginModal } from "~/components/LoginModal";
import { ChatNavbar } from "~/components/Navbar";
import { ChatSidebar } from "~/components/Sidebar";
import { TurnstileWidget } from "~/components/TurnstileWidget";
import { useKeyboardShortcuts } from "~/hooks/useKeyboardShortcuts";
import { useChatStore } from "~/state/stores/chatStore";

interface AppLayoutProps {
  children: React.ReactNode;
  isChat?: boolean;
}

export function AppLayout({ children, isChat = false }: AppLayoutProps) {
  const { sidebarVisible } = useChatStore();
  useKeyboardShortcuts();

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  return (
    <div className="flex h-dvh w-full max-w-full overflow-hidden bg-off-white dark:bg-zinc-900">
      <div className="flex flex-row w-full overflow-hidden relative">
        {isChat && (
          <ChatSidebar onEnterApiKey={() => setIsLoginModalOpen(true)} />
        )}
        <div className="flex flex-col min-w-0 flex-1 h-full">
          <ChatNavbar showSidebarToggle={isChat && !sidebarVisible} />
          <div className="flex-1 overflow-auto w-full">
            {children}
            <LoginModal
              open={isLoginModalOpen}
              onOpenChange={setIsLoginModalOpen}
              onKeySubmit={() => setIsLoginModalOpen(false)}
            />
          </div>
        </div>
      </div>
      <TurnstileWidget />
    </div>
  );
}
