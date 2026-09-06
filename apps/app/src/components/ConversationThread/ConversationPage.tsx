import { PageTitle } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

import { ChatSidebar } from "~/components/ChatSidebar";
import { PageShell } from "~/components/Core/PageShell";

import { ConversationThread, type ConversationThreadModeConfig } from ".";
import { ConversationProductHeader } from "./ConversationProductHeader";
import { ConversationThreadNavigation } from "./ConversationThreadNavigation";
import { useConversationLaunchModeConfig } from "./useConversationLaunchModeConfig";

interface ConversationPageProps {
  embedded?: boolean;
  title: string;
  modeConfig?: ConversationThreadModeConfig;
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {!embedded && <ConversationProductHeader />}
      {embedded && (
        <div className="@container flex justify-end px-3">
          <ConversationThreadNavigation />
        </div>
      )}
      <div className="relative flex min-h-0 flex-1 flex-grow flex-row overflow-hidden">
        <div className="flex min-h-0 w-full flex-grow flex-col">
          <div className="relative min-h-0 flex-1 overflow-clip">
            <ConversationThread modeConfig={effectiveModeConfig} />
          </div>
        </div>
      </div>
    </div>
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
