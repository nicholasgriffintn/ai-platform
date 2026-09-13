import { ArtifactWorkbenchPanel } from "@ngriffin_uk/polychat-component-content";
import {
  ProjectWorkbenchShell,
  type ConversationWorkbenchAttention,
  type ProjectWorkbenchHeaderSlots,
  type ProjectWorkbenchPane,
} from "@ngriffin_uk/polychat-component-workspaces";
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { getComputerObservations } from "@ngriffin_uk/polychat-library-chat/tool-results";
import {
  ARTIFACT_WORKBENCH_MIN_WIDTH,
  ArtifactWorkbenchProvider,
  useArtifactWorkbench,
  useConversationBrief,
} from "@ngriffin_uk/polychat-library-react";
import { useMemo, useState, type ReactNode } from "react";

import { WorkbenchComputerPreview } from "../Work/WorkbenchComputerPreview.js";
import { ConversationBriefPanel } from "./ConversationBriefPanel.js";
import { useConversationBriefAttention } from "./useConversationBriefAttention.js";

export function ConversationWorkbenchLayout({
  conversationId,
  conversationMessages,
  renderHeader,
  children,
}: {
  conversationId?: string | null;
  conversationMessages?: Message[];
  renderHeader: (actions: ReactNode) => ReactNode;
  children: ReactNode;
}) {
  return (
    <ArtifactWorkbenchProvider>
      <ConversationWorkbenchLayoutInner
        conversationId={conversationId}
        conversationMessages={conversationMessages}
        renderHeader={renderHeader}
      >
        {children}
      </ConversationWorkbenchLayoutInner>
    </ArtifactWorkbenchProvider>
  );
}

function ConversationWorkbenchLayoutInner({
  conversationId,
  conversationMessages,
  renderHeader,
  children,
}: {
  conversationId?: string | null;
  conversationMessages?: Message[];
  renderHeader: (actions: ReactNode) => ReactNode;
  children: ReactNode;
}) {
  const brief = useConversationBrief(conversationId ?? undefined);
  const [selectedPane, setSelectedPane] = useState<ProjectWorkbenchPane>("context");
  const [dockCollapsed, setDockCollapsed] = useState(true);
  const [dockWidth, setDockWidth] = useState(440);
  const briefAttention = useConversationBriefAttention(
    conversationId ?? undefined,
    brief.data?.document?.revision,
    brief.isFetched,
  );
  const artifact = useArtifactWorkbench();
  const hasArtifact = artifact.isPanelVisible && artifact.currentArtifact !== null;
  const computerObservations = useMemo(
    () => getComputerObservations(conversationMessages),
    [conversationMessages],
  );
  const latestComputerObservation = computerObservations[computerObservations.length - 1];
  const computerAttention: ConversationWorkbenchAttention | undefined = latestComputerObservation
    ? { key: `computer:${latestComputerObservation.id}`, pane: "preview" }
    : undefined;
  const attention = hasArtifact
    ? {
        key: `artifact:${artifact.currentArtifact?.identifier ?? "artifact"}:${artifact.openCount}`,
        pane: "artifact" as const,
      }
    : (briefAttention ?? computerAttention);
  const header = ({ actions }: ProjectWorkbenchHeaderSlots) => renderHeader(actions);

  return (
    <ProjectWorkbenchShell
      header={header}
      conversation={children}
      panels={{
        context: conversationId ? <ConversationBriefPanel conversationId={conversationId} /> : null,
        preview:
          computerObservations.length > 0 ? (
            <WorkbenchComputerPreview observations={computerObservations} />
          ) : undefined,
        artifact: hasArtifact ? (
          <ArtifactWorkbenchPanel
            artifact={artifact.currentArtifact}
            artifacts={artifact.currentArtifacts}
            isCombined={artifact.isCombinedPanel}
            copied={artifact.copied}
            onCopy={artifact.copyArtifact}
            onClose={artifact.closePanel}
            onAddSelectionToChat={artifact.addArtifactSelection}
          />
        ) : undefined,
      }}
      availablePanes={[
        ...(conversationId ? (["context"] as const) : []),
        ...(hasArtifact ? (["artifact"] as const) : []),
        ...(computerObservations.length > 0 ? (["preview"] as const) : []),
      ]}
      attention={attention}
      status="ready"
      showStatus={false}
      title="Conversation workbench"
      selectedPane={selectedPane}
      onSelectedPaneChange={setSelectedPane}
      dockCollapsed={dockCollapsed}
      onDockCollapsedChange={setDockCollapsed}
      dockWidth={hasArtifact ? Math.max(dockWidth, ARTIFACT_WORKBENCH_MIN_WIDTH) : dockWidth}
      onDockWidthChange={setDockWidth}
    />
  );
}
