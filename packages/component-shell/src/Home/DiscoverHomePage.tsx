import type { ThreadModeConfig } from "@ngriffin_uk/polychat-component-conversation";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  ArtifactWorkbenchProvider,
  getPlacePaths,
  useComposerPrefill,
} from "@ngriffin_uk/polychat-library-react";
import { useEffect, useMemo, useState } from "react";

import { ConversationArtifactOverlay } from "../Conversations/ConversationArtifactOverlay.js";
import {
  DiscoverEditionView,
  type DiscoverChatSlot,
} from "../Discover/Edition/DiscoverEditionView.js";
import { ChatConversationShell } from "../Shell/ChatConversationShell.js";
import { HomeChatPanelHeader } from "./HomeChatPanelHeader.js";
import { HomeConversationThread } from "./HomeConversationThread.js";

export interface DiscoverHomePageProps {
  hostModeConfig?: ThreadModeConfig;
}

function HomeChatThread({ modeConfig }: { modeConfig: ThreadModeConfig }) {
  return (
    <ArtifactWorkbenchProvider>
      <div className="relative h-full min-h-0 overflow-hidden">
        <HomeConversationThread urlModeConfig={modeConfig} routeToConversation={false} />
        <ConversationArtifactOverlay />
      </div>
    </ArtifactWorkbenchProvider>
  );
}

function useHomeChatSlot(modeConfig: ThreadModeConfig): DiscoverChatSlot {
  const conversationId = useChatStore((state) => state.currentConversationId);
  const clearCurrentConversation = useChatStore((state) => state.clearCurrentConversation);
  const [staleConversationId] = useState(() => useChatStore.getState().currentConversationId);

  useEffect(() => {
    clearCurrentConversation();
  }, [clearCurrentConversation]);

  const isOpen = Boolean(conversationId) && conversationId !== staleConversationId;

  return useMemo(
    () => ({
      isOpen,
      header:
        isOpen && conversationId ? (
          <HomeChatPanelHeader conversationId={conversationId} onClose={clearCurrentConversation} />
        ) : null,
      thread: <HomeChatThread modeConfig={modeConfig} />,
    }),
    [clearCurrentConversation, conversationId, isOpen, modeConfig],
  );
}

export function DiscoverHomePage({ hostModeConfig }: DiscoverHomePageProps = {}) {
  const modeConfig = useMemo<ThreadModeConfig>(
    () => ({
      analyticsSource: "home",
      ...hostModeConfig,
      assistantActionRoutes: { recipes: getPlacePaths("chat").scheduled },
      welcomePlacement: "composer",
      composerDensity: "slim",
      inputPlaceholder: {
        newConversation: "Ask Poly anything",
        followUp: "Ask a follow-up",
      },
    }),
    [hostModeConfig],
  );
  const chat = useHomeChatSlot(modeConfig);

  useComposerPrefill();

  return (
    <ChatConversationShell title="Discover">
      <DiscoverEditionView chat={chat} />
    </ChatConversationShell>
  );
}
