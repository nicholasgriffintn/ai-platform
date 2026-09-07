import {
  ConversationSurfaceLayout,
  type ThreadModeConfig,
} from "@ngriffin_uk/polychat-component-conversation";
import {
  CanvasGenerationsView,
  CanvasSidebarControls,
} from "@ngriffin_uk/polychat-component-experiences/media";
import { Button, PageTitle } from "@ngriffin_uk/polychat-component-ui";
import { useComposerPrefill, useTrackEvent } from "@ngriffin_uk/polychat-library-react";
import { Image as ImageIcon, MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { useCanvasStudio } from "../Apps/Canvas/useCanvasStudio.js";
import { ChatSidebar } from "../Chat/ChatSidebar.js";
import { ConversationProductHeader } from "../Header/ConversationProductHeader.js";
import { ProductModeHeader } from "../Header/ProductModeHeader.js";
import { PageShell } from "../Shell/PageShell.js";
import { HomeConversationThread } from "./HomeConversationThread.js";
import { useHomeChatModeConfig } from "./useHomeChatModeConfig.js";

export interface HomePageProps {
  hostModeConfig?: ThreadModeConfig;
}

export function HomePage({ hostModeConfig }: HomePageProps = {}) {
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
    setIsCanvasMode(!isCanvasMode);

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
      <ConversationSurfaceLayout
        header={isCanvasMode ? <ProductModeHeader /> : <ConversationProductHeader />}
      >
        {isCanvasMode ? (
          <CanvasGenerationsView canvas={canvas} />
        ) : (
          <HomeConversationThread urlModeConfig={modeConfig} />
        )}
      </ConversationSurfaceLayout>
    </PageShell>
  );
}
