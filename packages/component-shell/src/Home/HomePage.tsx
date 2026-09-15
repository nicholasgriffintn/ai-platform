import type { ThreadModeConfig } from "@ngriffin_uk/polychat-component-conversation";
import { PageTitle } from "@ngriffin_uk/polychat-component-ui";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useChat, useComposerPrefill } from "@ngriffin_uk/polychat-library-react";
import { useMemo } from "react";
import { useParams } from "react-router";

import { ChatSidebar } from "../Chat/ChatSidebar.js";
import { ConversationWorkbenchLayout } from "../Conversations/ConversationWorkbenchLayout.js";
import { ConversationProductHeader } from "../Header/ConversationProductHeader.js";
import { PageShell } from "../Shell/PageShell.js";
import { HomeConversationThread } from "./HomeConversationThread.js";
import { useHomeChatModeConfig } from "./useHomeChatModeConfig.js";

export interface HomePageProps {
  hostModeConfig?: ThreadModeConfig;
}

export function HomePage({ hostModeConfig }: HomePageProps = {}) {
  const { completionId } = useParams<"completionId">();
  const currentConversationId = useChatStore((state) => state.currentConversationId);
  const { data: currentConversation } = useChat(currentConversationId ?? undefined);
  const { modeConfig: chatModeConfig } = useHomeChatModeConfig();
  const modeConfig = useMemo(
    () => ({ ...hostModeConfig, ...chatModeConfig }),
    [chatModeConfig, hostModeConfig],
  );

  useComposerPrefill();

  return (
    <PageShell
      sidebarContent={<ChatSidebar />}
      fullBleed
      displayNavBar={false}
      headerContent={<PageTitle title="Conversation" className="sr-only" />}
    >
      <ConversationWorkbenchLayout
        conversationId={currentConversationId}
        conversationMessages={currentConversation?.messages}
        renderHeader={(actions) => (
          <ConversationProductHeader
            additionalActions={actions}
            showProductModeSwitch={!completionId}
          />
        )}
      >
        <HomeConversationThread urlModeConfig={modeConfig} />
      </ConversationWorkbenchLayout>
    </PageShell>
  );
}
