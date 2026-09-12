import {
  ProjectWorkbenchShell,
  type ProjectWorkbenchHeaderSlots,
  type ProjectWorkbenchPane,
} from "@ngriffin_uk/polychat-component-workspaces";
import { useConversationBrief } from "@ngriffin_uk/polychat-library-react";
import { useState, type ReactNode } from "react";

import { ConversationBriefPanel } from "./ConversationBriefPanel.js";
import { useConversationBriefAttention } from "./useConversationBriefAttention.js";

export function ConversationWorkbenchLayout({
  conversationId,
  renderHeader,
  children,
}: {
  conversationId?: string | null;
  renderHeader: (actions: ReactNode) => ReactNode;
  children: ReactNode;
}) {
  const brief = useConversationBrief(conversationId ?? undefined);
  const [selectedPane, setSelectedPane] = useState<ProjectWorkbenchPane>("context");
  const [dockCollapsed, setDockCollapsed] = useState(true);
  const [dockWidth, setDockWidth] = useState(440);
  const attention = useConversationBriefAttention(
    conversationId ?? undefined,
    brief.data?.document?.revision,
    brief.isFetched,
  );
  const header = ({ actions }: ProjectWorkbenchHeaderSlots) => renderHeader(actions);

  return (
    <ProjectWorkbenchShell
      header={header}
      conversation={children}
      panels={{
        context: conversationId ? <ConversationBriefPanel conversationId={conversationId} /> : null,
      }}
      availablePanes={conversationId ? ["context"] : []}
      attention={attention}
      status="ready"
      showStatus={false}
      title="Conversation workbench"
      selectedPane={selectedPane}
      onSelectedPaneChange={setSelectedPane}
      dockCollapsed={dockCollapsed}
      onDockCollapsedChange={setDockCollapsed}
      dockWidth={dockWidth}
      onDockWidthChange={setDockWidth}
    />
  );
}
