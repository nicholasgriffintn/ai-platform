import {
  ConversationSurfaceLayout,
  type ThreadModeConfig,
} from "@ngriffin_uk/polychat-component-conversation";
import {
  CanvasGenerationsView,
  CanvasSidebarControls,
} from "@ngriffin_uk/polychat-component-experiences/media";
import { Button, PageTitle } from "@ngriffin_uk/polychat-component-ui";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useComposerPrefill, useTrackEvent } from "@ngriffin_uk/polychat-library-react";
import { Image as ImageIcon, MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useParams } from "react-router";

import { useCanvasStudio } from "../Apps/Canvas/useCanvasStudio.js";
import { ChatSidebar } from "../Chat/ChatSidebar.js";
import { ConversationWorkbenchLayout } from "../Conversations/ConversationWorkbenchLayout.js";
import { ConversationProductHeader } from "../Header/ConversationProductHeader.js";
import { ProductModeHeader } from "../Header/ProductModeHeader.js";
import { PageShell } from "../Shell/PageShell.js";
import { HomeConversationThread } from "./HomeConversationThread.js";
import { useHomeChatModeConfig } from "./useHomeChatModeConfig.js";

export interface HomePageProps {
  hostModeConfig?: ThreadModeConfig;
}

export function HomePage({ hostModeConfig }: HomePageProps = {}) {
  const { completionId } = useParams<"completionId">();
  const currentConversationId = useChatStore((state) => state.currentConversationId);
  const [isCanvasMode, setIsCanvasMode] = useState(false);
  const { modeConfig: chatModeConfig } = useHomeChatModeConfig();
  const modeConfig = useMemo(
    () => ({ ...hostModeConfig, ...chatModeConfig }),
    [chatModeConfig, hostModeConfig],
  );
  const canvas = useCanvasStudio({ enabled: isCanvasMode });
  const { trackEvent } = useTrackEvent();

  useComposerPrefill();

  const toggleCanvasMode = () => {
    setIsCanvasMode((current) => !current);

    trackEvent({
      name: isCanvasMode ? "switch_to_chat" : "switch_to_canvas",
      category: "sidebar",
      label: isCanvasMode ? "switch_to_chat" : "switch_to_canvas",
      value: 1,
    });
  };

  return (
    <PageShell
      sidebarContent={
        <ChatSidebar
          contentOverride={isCanvasMode ? <CanvasSidebarControls canvas={canvas} /> : undefined}
          headerActions={
            <Button
              type="button"
              variant={isCanvasMode ? "iconActive" : "icon"}
              title={isCanvasMode ? "Switch to chat" : "Switch to image generation"}
              aria-label={isCanvasMode ? "Switch to chat" : "Switch to image generation"}
              icon={isCanvasMode ? <MessageCircle size={20} /> : <ImageIcon size={20} />}
              onClick={toggleCanvasMode}
            />
          }
        />
      }
      fullBleed
      displayNavBar={false}
      headerContent={<PageTitle title="Conversation" className="sr-only" />}
    >
      {isCanvasMode ? (
        <ConversationSurfaceLayout header={<ProductModeHeader />}>
          <CanvasGenerationsView canvas={canvas} />
        </ConversationSurfaceLayout>
      ) : (
        <ConversationWorkbenchLayout
          conversationId={currentConversationId}
          renderHeader={(actions) => (
            <ConversationProductHeader
              additionalActions={actions}
              showProductModeSwitch={!completionId}
            />
          )}
        >
          <HomeConversationThread urlModeConfig={modeConfig} />
        </ConversationWorkbenchLayout>
      )}
    </PageShell>
  );
}
