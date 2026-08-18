import { ConversationSurfaceLayout } from "@ngriffin_uk/polychat-component-conversation";
import { CanvasGenerationsView } from "@ngriffin_uk/polychat-component-experiences/media";
import { PageTitle } from "@ngriffin_uk/polychat-component-ui";
import { useState } from "react";

import { useCanvasStudio } from "~/components/Canvas/useCanvasStudio";
import { ChatSidebar } from "~/components/ChatSidebar";
import { ConversationProductHeader } from "~/components/ConversationThread/ConversationProductHeader";
import { PageShell } from "~/components/Core/PageShell";
import { ProductModeHeader } from "~/components/Core/ProductModeHeader";

import { HomeConversationThread } from "./HomeConversationThread";
import { useHomeChatModeConfig } from "./useHomeChatModeConfig";

export function HomePage() {
  const [isCanvasMode, setIsCanvasMode] = useState(false);
  const { modeConfig } = useHomeChatModeConfig();
  const canvas = useCanvasStudio({ enabled: isCanvasMode });

  return (
    <PageShell
      sidebarContent={
        <ChatSidebar
          canvas={canvas}
          isCanvasMode={isCanvasMode}
          onCanvasModeChange={setIsCanvasMode}
        />
      }
      fullBleed={true}
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
