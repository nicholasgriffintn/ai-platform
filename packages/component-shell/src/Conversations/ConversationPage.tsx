import {
  ConversationSurface,
  type ThreadModeConfig,
  useConversationLaunchModeConfig,
} from "@ngriffin_uk/polychat-component-conversation";
import { useChat } from "@ngriffin_uk/polychat-library-react";
import type { ReactNode } from "react";

import { ConversationProductHeader } from "../Header/ConversationProductHeader.js";
import { ConversationThreadNavigation } from "../Header/ConversationThreadNavigation.js";
import { ChatConversationShell } from "../Shell/ChatConversationShell.js";
import { ConversationWorkbenchLayout } from "./ConversationWorkbenchLayout.js";
interface ConversationPageProps {
  embedded?: boolean;
  header?: ReactNode | null;
  title: string;
  modeConfig?: ThreadModeConfig;
  pathConversationId?: string;
  sidebarContent?: ReactNode;
}

export function ConversationPage({
  embedded = false,
  header,
  title,
  modeConfig,
  pathConversationId,
  sidebarContent,
}: ConversationPageProps) {
  const effectiveModeConfig = useConversationLaunchModeConfig(modeConfig, pathConversationId);
  const { data: currentConversation } = useChat(pathConversationId ?? undefined);

  if (embedded) {
    const embeddedHeader =
      header !== undefined ? (
        header
      ) : (
        <div className="@container flex justify-end px-3">
          <ConversationThreadNavigation />
        </div>
      );

    return <ConversationSurface modeConfig={effectiveModeConfig} header={embeddedHeader} />;
  }

  const content = (
    <ConversationWorkbenchLayout
      conversationId={pathConversationId}
      conversationMessages={currentConversation?.messages}
      conversationTitle={currentConversation?.title}
      renderHeader={(actions) =>
        header !== undefined ? (
          header
        ) : (
          <ConversationProductHeader
            additionalActions={actions}
            requestOptions={effectiveModeConfig?.requestOptions}
            showProductModeSwitch={!pathConversationId}
          />
        )
      }
    >
      <ConversationSurface modeConfig={effectiveModeConfig} header={null} />
    </ConversationWorkbenchLayout>
  );

  return (
    <ChatConversationShell title={title} sidebarContent={sidebarContent}>
      {content}
    </ChatConversationShell>
  );
}
