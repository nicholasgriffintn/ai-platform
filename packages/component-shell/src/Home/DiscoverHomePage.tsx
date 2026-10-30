import type { ThreadModeConfig } from "@ngriffin_uk/polychat-component-conversation";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  ArtifactWorkbenchProvider,
  getPlacePaths,
  useComposerPrefill,
} from "@ngriffin_uk/polychat-library-react";
import { useEffect, useMemo } from "react";

import { ConversationArtifactOverlay } from "../Conversations/ConversationArtifactOverlay.js";
import { DiscoverEditionView } from "../Discover/Edition/DiscoverEditionView.js";
import { ChatConversationShell } from "../Shell/ChatConversationShell.js";
import { HomeConversationThread } from "./HomeConversationThread.js";

export interface DiscoverHomePageProps {
  hostModeConfig?: ThreadModeConfig;
}

function HomeAskPane({ modeConfig }: { modeConfig: ThreadModeConfig }) {
  return (
    <ArtifactWorkbenchProvider>
      <div className="relative h-full min-h-0 overflow-hidden">
        <HomeConversationThread urlModeConfig={modeConfig} />
        <ConversationArtifactOverlay />
      </div>
    </ArtifactWorkbenchProvider>
  );
}

export function DiscoverHomePage({ hostModeConfig }: DiscoverHomePageProps = {}) {
  const clearCurrentConversation = useChatStore((state) => state.clearCurrentConversation);
  const modeConfig = useMemo<ThreadModeConfig>(
    () => ({
      analyticsSource: "home",
      ...hostModeConfig,
      assistantActionRoutes: { recipes: getPlacePaths("chat").scheduled },
      inputPlaceholder: {
        newConversation: "Ask Poly anything",
        followUp: "Ask a follow-up",
      },
    }),
    [hostModeConfig],
  );

  useEffect(() => {
    clearCurrentConversation();
  }, [clearCurrentConversation]);

  useComposerPrefill();

  return (
    <ChatConversationShell title="Discover">
      <DiscoverEditionView ask={<HomeAskPane modeConfig={modeConfig} />} />
    </ChatConversationShell>
  );
}
