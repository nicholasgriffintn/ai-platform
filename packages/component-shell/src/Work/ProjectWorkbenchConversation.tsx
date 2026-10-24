import {
  ArtifactWorkbenchPanel,
  RunChangesView,
  RunFilesView,
} from "@ngriffin_uk/polychat-component-content";
import { RunActivityPanel } from "@ngriffin_uk/polychat-component-conversation";
import type { ConversationRunSteering } from "@ngriffin_uk/polychat-component-conversation";
import {
  ProjectWorkbenchApprovals,
  ProjectWorkbenchRunControls,
  ProjectWorkbenchPreview,
  ProjectWorkbenchRunPanel,
  ProjectWorkbenchSection,
  ProjectWorkbenchServices,
  ProjectWorkbenchShell,
  type ConversationWorkbenchAttention,
  type ProjectWorkbenchHeaderSlots,
  type ProjectWorkbenchPane,
} from "@ngriffin_uk/polychat-component-workspaces";
import { buildAgentTraceEntries } from "@ngriffin_uk/polychat-library-chat/agent-trace";
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { buildRunActivityEntries } from "@ngriffin_uk/polychat-library-chat/run-activity";
import { getComputerObservations } from "@ngriffin_uk/polychat-library-chat/tool-results";
import { getOutputArtifactContent, useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  ArtifactWorkbenchProvider,
  useArtifactWorkbench,
  useProjectWorkbenchControls,
  useProjectWorkbenchDiff,
  useProjectWorkbenchLayout,
  useProjectWorkbenchPreview,
  useProjectWorkbenchRuns,
  deriveProjectWorkbenchControlState,
  deriveProjectWorkbenchPanes,
  deriveProjectWorkbenchPresentation,
  deriveProjectWorkbenchServices,
  formatProjectWorkbenchPreviewFeedback,
  useCancelDelegations,
  useDelegations,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";
import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import type { ProjectWorkbenchLayout } from "@ngriffin_uk/polychat-utility-react";
import { Activity } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { ConversationContextRail } from "../Conversations/ConversationContextRail.js";
import { useConversationWorkbenchContext } from "../Conversations/useConversationWorkbenchContext.js";
import { ProjectDelegatesPanel } from "../Delegations/ProjectDelegatesPanel.js";
import { ProjectRunChangesCard } from "./ProjectRunChangesCard.js";
import { WorkbenchComputerPreview } from "./WorkbenchComputerPreview.js";

const PROJECT_WORKBENCH_LAYOUT_KEY = "polychat:work-workbench";

export interface ProjectWorkbenchConversationSlots {
  runSteering?: ConversationRunSteering;
  composerBanner?: ReactNode;
}

interface ProjectWorkbenchConversationProps {
  projectId: string;
  conversationId?: string | null;
  hasCodingEnvironment: boolean;
  conversationIsStreaming: boolean;
  conversationMessages?: Message[];
  task?: ProjectTask;
  renderHeader: (slots: ProjectWorkbenchHeaderSlots) => ReactNode;
  children: (slots: ProjectWorkbenchConversationSlots) => ReactNode;
}

export function ProjectWorkbenchConversation(props: ProjectWorkbenchConversationProps) {
  return (
    <ArtifactWorkbenchProvider>
      <ProjectWorkbenchConversationInner {...props} />
    </ArtifactWorkbenchProvider>
  );
}

function ProjectWorkbenchConversationInner({
  projectId,
  conversationId,
  hasCodingEnvironment,
  conversationIsStreaming,
  conversationMessages,
  task,
  renderHeader,
  children,
}: ProjectWorkbenchConversationProps) {
  const effectiveConversationId = conversationId ?? task?.conversationId;
  const runsQuery = useProjectWorkbenchRuns({
    projectId,
    conversationId: effectiveConversationId,
    conversationIsStreaming,
  });
  const layout = useProjectWorkbenchLayout(PROJECT_WORKBENCH_LAYOUT_KEY);
  const workbench = useConversationWorkbenchContext(effectiveConversationId ?? undefined);
  const currentUserId = useChatStore((state) => state.user?.id);
  const setOpenFile = useUIStore((state) => state.setOpenFile);
  const diff = useProjectWorkbenchDiff(runsQuery.currentRun);
  const controls = useProjectWorkbenchControls({
    runId: runsQuery.currentRun?.runId,
    control: runsQuery.currentControl,
    instructions: runsQuery.currentInstructions,
    onChanged: runsQuery.refetch,
  });
  const activityEntries = useMemo(
    () =>
      buildRunActivityEntries({
        run: runsQuery.currentRun,
        traceEntries: buildAgentTraceEntries(conversationMessages ?? []),
      }),
    [conversationMessages, runsQuery.currentRun],
  );
  const services = useMemo(
    () => deriveProjectWorkbenchServices(runsQuery.currentRun),
    [runsQuery.currentRun],
  );
  const previewServices = useMemo(
    () => services.filter((service) => Boolean(service.expectedPort)),
    [services],
  );
  const preview = useProjectWorkbenchPreview({
    runId: runsQuery.currentRun?.runId,
    services: previewServices,
    isRunLoading: runsQuery.isLoading,
  });
  const delegationsQuery = useDelegations(effectiveConversationId ?? "");
  const cancelDelegations = useCancelDelegations();
  const computerObservations = useMemo(
    () => getComputerObservations(conversationMessages),
    [conversationMessages],
  );
  const latestComputerObservation = computerObservations[computerObservations.length - 1];
  const attention = useMemo(() => {
    const blockedReason = task?.blockedReason;

    if (
      blockedReason === "awaiting_input" ||
      blockedReason === "awaiting_approval" ||
      blockedReason === "awaiting_takeover"
    ) {
      return task ? { key: `${task.id}:${blockedReason}`, pane: "activity" as const } : undefined;
    }

    if (latestComputerObservation) {
      return { key: `computer:${latestComputerObservation.id}`, pane: "preview" as const };
    }

    return undefined;
  }, [task, latestComputerObservation]);

  const presentation = deriveProjectWorkbenchPresentation({
    run: runsQuery.currentRun,
    task,
    control: runsQuery.currentControl,
    hasPendingApproval: controls.approvals.length > 0,
    hasCodingEnvironment,
  });
  const errorMessage = runsQuery.error
    ? getErrorMessage(runsQuery.error, "Run state could not be restored")
    : undefined;
  const controlState =
    runsQuery.currentControl?.state ?? deriveProjectWorkbenchControlState(runsQuery.currentRun);
  const isRunOwner = runsQuery.currentActivity?.createdByUserId === currentUserId;
  const controlsError = controls.error ?? runsQuery.detailError;
  const controlsErrorMessage = controlsError
    ? getErrorMessage(controlsError, "Live run controls are temporarily unavailable")
    : undefined;
  const runIsTerminal =
    runsQuery.currentRun?.status === "completed" ||
    runsQuery.currentRun?.status === "failed" ||
    runsQuery.currentRun?.status === "cancelled";
  const controlsDisabledReason =
    runsQuery.currentRun && !runsQuery.currentControl && !runIsTerminal
      ? (controlsErrorMessage ?? "Live run controls are temporarily unavailable. Refresh to retry.")
      : undefined;
  const canSubmitPreviewFeedback = Boolean(
    isRunOwner && !runIsTerminal && runsQuery.currentControl,
  );
  const previewFeedbackDisabledReason = !isRunOwner
    ? "Only the person who started this run can send instructions."
    : runIsTerminal
      ? "This run has finished. Start another run to act on new feedback."
      : controlsDisabledReason;
  const runControls =
    runsQuery.currentRun && controlState ? (
      <ProjectWorkbenchRunControls
        runStatus={runsQuery.currentRun.status}
        controlState={controlState}
        canControl={isRunOwner}
        disabledReason={controlsDisabledReason}
        isSubmittingInstruction={controls.isSubmittingInstruction}
        isUpdatingControl={controls.isUpdatingControl}
        onContinue={controls.continueRun}
        onPause={controls.pauseRun}
        onResume={controls.resumeRun}
        onCancel={controls.cancelRun}
      />
    ) : undefined;
  const runSteering: ConversationRunSteering | undefined =
    runsQuery.currentRun && controlState && !runIsTerminal
      ? {
          placeholder: "Steer the run with a focused instruction…",
          disabledReason: !isRunOwner
            ? "Only the person who started this run can steer it."
            : controlsDisabledReason,
          isSubmitting: controls.isSubmittingInstruction,
          onSubmit: controls.addInstruction,
        }
      : undefined;
  const composerBanner = (
    <ProjectWorkbenchApprovals
      approvals={controls.approvals}
      canControl={isRunOwner && !runIsTerminal}
      disabledReason={controlsDisabledReason}
      isUpdating={controls.isSubmittingInstruction}
      errorMessage={controlsErrorMessage}
      onResolve={controls.resolveApproval}
    />
  );
  const renderPanel = (pane: ProjectWorkbenchPane) => (
    <ProjectWorkbenchRunPanel
      pane={pane}
      run={runsQuery.currentRun}
      isLoading={runsQuery.isLoading}
      errorMessage={errorMessage}
    />
  );
  const recordedFiles = runsQuery.currentRun?.manifest?.changes.files ?? [];
  const artifacts = runsQuery.currentRun?.manifest?.artifacts ?? [];
  const availablePanes = deriveProjectWorkbenchPanes({
    hasArtifact: false,
    hasActivity: Boolean(runsQuery.currentRun || activityEntries.length > 0 || services.length > 0),
    hasPreview: previewServices.length > 0 || computerObservations.length > 0,
    hasChanges: recordedFiles.length > 0 || Boolean(diff.content),
    hasFiles: recordedFiles.length > 0 || artifacts.length > 0,
    hasProof: Boolean(runsQuery.currentRun),
    hasDelegates: Boolean(delegationsQuery.data?.data.length),
  });
  const panels = {
    activity: (
      <>
        <ProjectWorkbenchServices
          services={services}
          canControl={isRunOwner && !runIsTerminal}
          disabledReason={controlsDisabledReason}
          isUpdating={controls.isSubmittingInstruction}
          errorMessage={controlsErrorMessage}
          onAction={controls.serviceAction}
        />
        <ProjectWorkbenchSection
          title="Timeline"
          label="Conversation and run timeline"
          icon={Activity}
        >
          <RunActivityPanel
            entries={activityEntries}
            isLoading={runsQuery.isLoading}
            errorMessage={errorMessage}
          />
        </ProjectWorkbenchSection>
      </>
    ),
    preview: (
      <>
        {computerObservations.length > 0 ? (
          <WorkbenchComputerPreview observations={computerObservations} />
        ) : null}
        <ProjectWorkbenchPreview
          services={previewServices}
          selectedServiceName={preview.selectedServiceName}
          preview={preview.preview}
          state={preview.state}
          canCreate={preview.canCreate}
          canSubmitFeedback={canSubmitPreviewFeedback}
          disabledReason={preview.disabledReason}
          feedbackDisabledReason={previewFeedbackDisabledReason}
          isCreating={preview.isCreating}
          isRevoking={preview.isRevoking}
          isSubmittingFeedback={controls.isSubmittingInstruction}
          errorMessage={
            preview.error
              ? getErrorMessage(preview.error, "Preview access is temporarily unavailable")
              : undefined
          }
          onSelectedServiceChange={preview.setSelectedServiceName}
          onCreate={preview.create}
          onRefresh={preview.refresh}
          onOpenExternal={preview.openExternal}
          onRevoke={preview.revoke}
          onSubmitFeedback={async (feedback) => {
            await controls.addInstruction(formatProjectWorkbenchPreviewFeedback(feedback));
          }}
        />
      </>
    ),
    changes: (
      <RunChangesView
        content={diff.content}
        recordedFiles={runsQuery.currentRun?.manifest?.changes.files}
        isLoading={diff.isLoading}
        errorMessage={
          diff.error ? getErrorMessage(diff.error, "The run diff could not be loaded") : undefined
        }
      />
    ),
    files: (
      <RunFilesView
        diffContent={diff.content}
        recordedFiles={runsQuery.currentRun?.manifest?.changes.files}
        artifacts={runsQuery.currentRun?.manifest?.artifacts ?? []}
        loadArtifact={getOutputArtifactContent}
        onOpenArtifact={(outputId) => setOpenFile({ origin: "output", id: outputId, projectId })}
      />
    ),
    proof: renderPanel("proof"),
    delegates: (
      <ProjectDelegatesPanel
        delegations={delegationsQuery.data?.data ?? []}
        teammates={delegationsQuery.data?.teammates}
        outputs={delegationsQuery.data?.outputs}
        canControl={delegationsQuery.data?.canControl ?? false}
        onStopAll={() => {
          if (effectiveConversationId) {
            void cancelDelegations.mutateAsync(effectiveConversationId);
          }
        }}
        onFollowUp={(input) => {
          void controls.addInstruction(input);
        }}
      />
    ),
  };

  return (
    <ProjectWorkbenchArtifactShell
      renderHeader={renderHeader}
      conversation={children({ runSteering, composerBanner })}
      context={
        effectiveConversationId ? (
          <ConversationContextRail conversationId={effectiveConversationId} workbench={workbench}>
            <ProjectRunChangesCard
              diffContent={diff.content}
              recordedFiles={recordedFiles}
              onOpenChanges={() => layout.openPane("changes")}
            />
          </ConversationContextRail>
        ) : null
      }
      contextLabel={workbench.usageLabel}
      panels={panels}
      availablePanes={availablePanes}
      attention={attention}
      status={presentation.status}
      statusDetail={presentation.detail}
      layout={layout}
      runControls={runControls}
    />
  );
}

function ProjectWorkbenchArtifactShell({
  renderHeader,
  conversation,
  context,
  contextLabel,
  panels,
  availablePanes,
  attention,
  status,
  statusDetail,
  layout,
  runControls,
}: {
  renderHeader: (slots: ProjectWorkbenchHeaderSlots) => ReactNode;
  conversation: ReactNode;
  context: ReactNode;
  contextLabel?: string;
  panels: Partial<Record<ProjectWorkbenchPane, ReactNode>>;
  availablePanes: readonly ProjectWorkbenchPane[];
  attention?: ConversationWorkbenchAttention;
  status: Parameters<typeof ProjectWorkbenchShell>[0]["status"];
  statusDetail?: string;
  layout: ProjectWorkbenchLayout;
  runControls?: ReactNode;
}) {
  const artifact = useArtifactWorkbench();
  const hasArtifact = artifact.isPanelVisible && artifact.currentArtifact !== null;
  const mergedAttention = hasArtifact
    ? {
        key: `artifact:${artifact.currentArtifact?.identifier ?? "artifact"}:${artifact.openCount}`,
        pane: "artifact" as const,
      }
    : attention;

  return (
    <ProjectWorkbenchShell
      header={renderHeader}
      conversation={conversation}
      context={context}
      contextLabel={contextLabel}
      panels={{
        ...panels,
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
      availablePanes={
        hasArtifact && !availablePanes.includes("artifact")
          ? ["artifact", ...availablePanes]
          : availablePanes
      }
      attention={mergedAttention}
      status={status}
      statusDetail={statusDetail}
      layout={layout}
      onPaneClose={(pane) => {
        if (pane === "artifact") {
          artifact.closePanel();
        }
      }}
      runControls={runControls}
    />
  );
}
