import {
  ConversationSurface,
  type ThreadModeConfig,
  useConversationLaunchModeConfig,
} from "@ngriffin_uk/polychat-component-conversation";
import {
  ChatSidebar,
  ConversationProductHeader,
  ConversationThreadNavigation,
  PageShell,
} from "@ngriffin_uk/polychat-component-shell";
import { PageTitle } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";
interface ConversationPageProps {
  embedded?: boolean;
  title: string;
  modeConfig?: ThreadModeConfig;
  pathConversationId?: string;
  sidebarContent?: ReactNode;
}

export function ConversationPage({
  embedded = false,
  title,
  modeConfig,
  pathConversationId,
  sidebarContent,
}: ConversationPageProps) {
  const effectiveModeConfig = useConversationLaunchModeConfig(modeConfig, pathConversationId);

  const content = (
    <ConversationSurface
      modeConfig={effectiveModeConfig}
      header={
        embedded ? (
          <div className="@container flex justify-end px-3">
            <ConversationThreadNavigation />
          </div>
        ) : (
          <ConversationProductHeader />
        )
      }
    />
  );

  if (embedded) {
    return content;
  }

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
