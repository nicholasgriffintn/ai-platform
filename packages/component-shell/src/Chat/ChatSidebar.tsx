import {
  ConversationStorageNotice,
  SidebarNavSection,
} from "@ngriffin_uk/polychat-component-navigation";
import { SidebarShell } from "@ngriffin_uk/polychat-component-ui";
import { shouldExplainStorage } from "@ngriffin_uk/polychat-library-chat/conversation-storage-policy";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  matchNotebookId,
  DISCOVER_PATH,
  MODE_BASE_PATHS,
  useUIStore,
  useConversationStorage,
} from "@ngriffin_uk/polychat-library-react";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useLocation, useMatches } from "react-router";
import { useShallow } from "zustand/react/shallow";

import { DiscoverSidebarSection } from "../Sidebar/DiscoverSidebarSection.js";
import { PlacesNavLinks } from "../Sidebar/PlacesNavLinks.js";
import { SidebarFooter } from "../Sidebar/SidebarFooter.js";
import { SidebarHeader } from "../Sidebar/SidebarHeader.js";
import { useSidebarPeekPanel } from "../Sidebar/SidebarPeekContext.js";
import { TeammateRosterSection } from "../Sidebar/TeammateRosterSection.js";
import { ChatSidebarConversations } from "./ChatSidebarConversations.js";

export interface ChatSidebarProps {
  contentOverride?: ReactNode;
  headerActions?: ReactNode;
}

export function ChatSidebar({ contentOverride, headerActions }: ChatSidebarProps) {
  const { pathname } = useLocation();
  const completionId = useMatches().at(-1)?.params.completionId;
  const isConversationRoute =
    pathname === DISCOVER_PATH || pathname === MODE_BASE_PATHS.chat || Boolean(completionId);
  const activeNotebookId = matchNotebookId(pathname);
  const { sidebarVisible, setSidebarVisible, isMobile } = useUIStore(
    useShallow((state) => ({
      sidebarVisible: state.sidebarVisible,
      setSidebarVisible: state.setSidebarVisible,
      isMobile: state.isMobile,
    })),
  );
  const { peeking, panelProps } = useSidebarPeekPanel();
  const { currentConversationId, isAuthenticated, isAuthenticationLoading } = useChatStore(
    useShallow((state) => ({
      currentConversationId: state.currentConversationId,
      isAuthenticated: state.isAuthenticated,
      isAuthenticationLoading: state.isAuthenticationLoading,
    })),
  );
  const { determineStorageMode } = useConversationStorage();
  const storageMode = determineStorageMode(currentConversationId);
  const storageNoticeReason = shouldExplainStorage(storageMode) ? storageMode.reason : null;

  const closeOnMobile = () => {
    if (isMobile) {
      setSidebarVisible(false);
    }
  };

  return (
    <SidebarShell
      visible={sidebarVisible}
      isMobile={isMobile}
      peeking={peeking}
      peekProps={panelProps}
      onClose={() => setSidebarVisible(false)}
      label="Conversations"
      header={<SidebarHeader actions={headerActions} />}
      footer={<SidebarFooter />}
    >
      {sidebarVisible && !contentOverride && !isAuthenticationLoading && (
        <div>
          <ConversationStorageNotice reason={storageNoticeReason} />
        </div>
      )}

      {contentOverride ? (
        contentOverride
      ) : isAuthenticationLoading ? (
        <div className="flex items-center gap-2 p-2">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <nav aria-label="Conversations">
          <div className="px-2 pb-3">
            <SidebarNavSection>
              <PlacesNavLinks onNavigate={closeOnMobile} />
            </SidebarNavSection>
            {isAuthenticated && <TeammateRosterSection onNavigate={closeOnMobile} />}
            {!isAuthenticated && (
              <div className="mt-4">
                <DiscoverSidebarSection onNavigate={closeOnMobile} />
              </div>
            )}
          </div>
          <ChatSidebarConversations
            isConversationRoute={isConversationRoute}
            activeNotebookId={activeNotebookId}
          />
        </nav>
      )}
    </SidebarShell>
  );
}
