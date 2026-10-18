import { ArtifactWorkbenchPanel } from "@ngriffin_uk/polychat-component-content";
import { RunActivityPanel } from "@ngriffin_uk/polychat-component-conversation";
import {
  ProjectWorkbenchShell,
  type ConversationWorkbenchAttention,
  type ProjectWorkbenchHeaderSlots,
  type ProjectWorkbenchPane,
} from "@ngriffin_uk/polychat-component-workspaces";
import { buildAgentTraceEntries } from "@ngriffin_uk/polychat-library-chat/agent-trace";
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { buildRunActivityEntries } from "@ngriffin_uk/polychat-library-chat/run-activity";
import { getComputerObservations } from "@ngriffin_uk/polychat-library-chat/tool-results";
import {
  ArtifactWorkbenchProvider,
  useArtifactWorkbench,
  useProjectWorkbenchLayout,
} from "@ngriffin_uk/polychat-library-react";
import { useMemo, type ReactNode } from "react";

import { WorkbenchComputerPreview } from "../Work/WorkbenchComputerPreview.js";
import { ConversationContextRail } from "./ConversationContextRail.js";
import { useConversationWorkbenchContext } from "./useConversationWorkbenchContext.js";

const CHAT_WORKBENCH_LAYOUT_KEY = "polychat:chat-workbench";

interface ConversationWorkbenchLayoutProps {
  conversationId?: string | null;
  conversationMessages?: Message[];
  renderHeader: (actions: ReactNode) => ReactNode;
  contextRail?: ReactNode;
  children: ReactNode;
}

export function ConversationWorkbenchLayout({
  conversationId,
  conversationMessages,
  renderHeader,
  contextRail,
  children,
}: ConversationWorkbenchLayoutProps) {
  return (
    <ArtifactWorkbenchProvider>
      <ConversationWorkbenchLayoutInner
        conversationId={conversationId}
        conversationMessages={conversationMessages}
        renderHeader={renderHeader}
        contextRail={contextRail}
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
  contextRail,
  children,
}: ConversationWorkbenchLayoutProps) {
  const layout = useProjectWorkbenchLayout(CHAT_WORKBENCH_LAYOUT_KEY);
  const workbench = useConversationWorkbenchContext(conversationId ?? undefined);
  const artifact = useArtifactWorkbench();
  const hasArtifact = artifact.isPanelVisible && artifact.currentArtifact !== null;
  const computerObservations = useMemo(
    () => getComputerObservations(conversationMessages),
    [conversationMessages],
  );
  const activityEntries = useMemo(
    () =>
      buildRunActivityEntries({ traceEntries: buildAgentTraceEntries(conversationMessages ?? []) }),
    [conversationMessages],
  );
  const latestComputerObservation = computerObservations[computerObservations.length - 1];
  const attention: ConversationWorkbenchAttention | undefined = hasArtifact
    ? {
        key: `artifact:${artifact.currentArtifact?.identifier ?? "artifact"}:${artifact.openCount}`,
        pane: "artifact",
      }
    : latestComputerObservation
      ? { key: `computer:${latestComputerObservation.id}`, pane: "preview" }
      : undefined;
  const header = ({ actions }: ProjectWorkbenchHeaderSlots) => renderHeader(actions);

  const handlePaneClose = (pane: ProjectWorkbenchPane) => {
    if (pane === "artifact") {
      artifact.closePanel();
    }
  };

  return (
    <ProjectWorkbenchShell
      header={header}
      conversation={children}
      context={
        conversationId ? (
          <ConversationContextRail conversationId={conversationId} workbench={workbench}>
            {contextRail}
          </ConversationContextRail>
        ) : null
      }
      contextLabel={workbench.usageLabel}
      panels={{
        activity:
          activityEntries.length > 0 ? <RunActivityPanel entries={activityEntries} /> : undefined,
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
            onAddSelectionToChat={artifact.addArtifactSelection}
          />
        ) : undefined,
      }}
      availablePanes={["artifact", "activity", "preview"]}
      attention={attention}
      status="ready"
      showStatus={false}
      title="Conversation workbench"
      layout={layout}
      onPaneClose={handlePaneClose}
    />
  );
}
