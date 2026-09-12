import {
  ConversationSurface,
  type ThreadModeConfig,
  useConversationLaunchModeConfig,
} from "@ngriffin_uk/polychat-component-conversation";
import { PageTitle } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

import { ChatSidebar } from "../Chat/ChatSidebar.js";
import { ConversationProductHeader } from "../Header/ConversationProductHeader.js";
import { ConversationThreadNavigation } from "../Header/ConversationThreadNavigation.js";
import { PageShell } from "../Shell/PageShell.js";
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
    <PageShell
      sidebarContent={sidebarContent ?? <ChatSidebar />}
      fullBleed
      displayNavBar={false}
      headerContent={<PageTitle title={title} className="sr-only" />}
    >
      {content}
    </PageShell>
  );
}
