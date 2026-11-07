import type { ThreadModeConfig } from "@ngriffin_uk/polychat-component-conversation";
import { cn } from "@ngriffin_uk/polychat-component-ui";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  ArtifactWorkbenchProvider,
  ConversationScopeProvider,
  getPlacePaths,
  useComposerPrefill,
  type ConversationScope,
} from "@ngriffin_uk/polychat-library-react";
import { useEffect, useMemo } from "react";

import { ConversationArtifactOverlay } from "../Conversations/ConversationArtifactOverlay.js";
import {
  DiscoverEditionView,
  type DiscoverChatSlot,
} from "../Discover/Edition/DiscoverEditionView.js";
import { ChatConversationShell } from "../Shell/ChatConversationShell.js";
import { HomeChatPanelHeader } from "./HomeChatPanelHeader.js";
import { HomeConversationThread } from "./HomeConversationThread.js";
import { useDiscoverConversationScope } from "./useDiscoverConversationScope.js";

export interface DiscoverHomePageProps {
  hostModeConfig?: ThreadModeConfig;
}

function HomeChatThread({
  modeConfig,
  scope,
  docked,
}: {
  modeConfig: ThreadModeConfig;
  scope: ConversationScope;
  docked: boolean;
}) {
  return (
    <ConversationScopeProvider scope={scope}>
      <ArtifactWorkbenchProvider>
        <div className={cn("relative h-full min-h-0", docked && "overflow-hidden")}>
          <HomeConversationThread urlModeConfig={modeConfig} routeToConversation={false} />
          <ConversationArtifactOverlay />
        </div>
      </ArtifactWorkbenchProvider>
    </ConversationScopeProvider>
  );
}

function useHomeChatSlot(modeConfig: ThreadModeConfig): DiscoverChatSlot {
  const scope = useDiscoverConversationScope();
  const clearCurrentConversation = useChatStore((state) => state.clearCurrentConversation);
  const conversationId = scope.currentConversationId;
  const isOpen = Boolean(conversationId);

  useEffect(() => {
    clearCurrentConversation();
  }, [clearCurrentConversation]);

  return useMemo(
    () => ({
      isOpen,
      header: conversationId ? (
        <HomeChatPanelHeader conversationId={conversationId} onClose={clearCurrentConversation} />
      ) : null,
      thread: <HomeChatThread modeConfig={modeConfig} scope={scope} docked={isOpen} />,
    }),
    [clearCurrentConversation, conversationId, isOpen, modeConfig, scope],
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
