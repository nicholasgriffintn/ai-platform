import { ConversationSurfaceLayout } from "@ngriffin_uk/polychat-component-conversation";
import {
  CanvasGenerationsView,
  CanvasSidebarControls,
} from "@ngriffin_uk/polychat-component-experiences/media";
import {
  ChatSidebar,
  ConversationProductHeader,
  PageShell,
  ProductModeHeader,
} from "@ngriffin_uk/polychat-component-shell";
import { Button, PageTitle } from "@ngriffin_uk/polychat-component-ui";
import { useComposerPrefill, useTrackEvent } from "@ngriffin_uk/polychat-library-react";
import { Image as ImageIcon, MessageCircle } from "lucide-react";
import { useState } from "react";

import { useCanvasStudio } from "~/components/Canvas/useCanvasStudio";

import { HomeConversationThread } from "./HomeConversationThread";
import { useHomeChatModeConfig } from "./useHomeChatModeConfig";

export function HomePage() {
  const [isCanvasMode, setIsCanvasMode] = useState(false);
  const { modeConfig } = useHomeChatModeConfig();
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
        header={
          isCanvasMode ? (
            <ProductModeHeader showCloudToggle />
          ) : (
            <ConversationProductHeader showCloudToggle />
          )
        }
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
