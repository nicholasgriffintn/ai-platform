import { RunChangesView, RunFilesView } from "@ngriffin_uk/polychat-component-content";
import { RunActivityPanel } from "@ngriffin_uk/polychat-component-conversation";
import { DelegationCard } from "@ngriffin_uk/polychat-component-conversation";
import type { ConversationRunSteering } from "@ngriffin_uk/polychat-component-conversation";
import {
  ProjectWorkbenchApprovals,
  ProjectWorkbenchRunControls,
  ProjectWorkbenchPreview,
  ProjectWorkbenchRunPanel,
  ProjectWorkbenchSection,
  ProjectWorkbenchServices,
  ProjectWorkbenchShell,
  type ProjectWorkbenchPane,
} from "@ngriffin_uk/polychat-component-workspaces";
import { buildAgentTraceEntries } from "@ngriffin_uk/polychat-library-chat/agent-trace";
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { buildRunActivityEntries } from "@ngriffin_uk/polychat-library-chat/run-activity";
import { getOutputArtifactContent, useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  useProjectWorkbenchControls,
  useProjectWorkbenchDiff,
  useProjectWorkbenchPreferences,
  useProjectWorkbenchPreview,
  useProjectWorkbenchRuns,
  getErrorMessage,
  deriveProjectWorkbenchControlState,
  deriveProjectWorkbenchPresentation,
  deriveProjectWorkbenchServices,
  formatProjectWorkbenchPreviewFeedback,
  useCancelDelegations,
  useDelegations,
} from "@ngriffin_uk/polychat-library-react";
import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { Activity } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { DelegatePanel } from "../Delegations/DelegatePanel.js";

export interface ProjectWorkbenchConversationSlots {
  runSteering?: ConversationRunSteering;
  composerBanner?: ReactNode;
}

export function ProjectWorkbenchConversation({
  projectId,
  conversationId,
  hasCodingEnvironment,
  conversationIsStreaming,
  conversationMessages,
  task,
  children,
}: {
  projectId: string;
  conversationId?: string | null;
  hasCodingEnvironment: boolean;
  conversationIsStreaming: boolean;
  conversationMessages?: Message[];
  task?: ProjectTask;
  children: (slots: ProjectWorkbenchConversationSlots) => ReactNode;
}) {
  const runsQuery = useProjectWorkbenchRuns({
    projectId,
    conversationId,
    conversationIsStreaming,
  });
  const preferences = useProjectWorkbenchPreferences();
  const currentUserId = useChatStore((state) => state.user?.id);
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
  const delegationsQuery = useDelegations(conversationId ?? "");
  const cancelDelegations = useCancelDelegations();
  const isWorkbenchEligible = hasCodingEnvironment || runsQuery.runs.length > 0;

  if (!hasCodingEnvironment && (runsQuery.isLoading || !isWorkbenchEligible)) {
    return children({});
  }

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
      />
    ),
    proof: renderPanel("proof"),
    delegates: delegationsQuery.data?.delegations.length ? (
      <div className="space-y-4">
        <DelegationCard
          delegations={delegationsQuery.data.delegations}
          onStopAll={() => {
            if (conversationId) {
              void cancelDelegations.mutateAsync(conversationId);
            }
          }}
        />
        <DelegatePanel
          conversationId={delegationsQuery.data.delegations[0].childConversationId}
          canControl={delegationsQuery.data.canControl}
        />
      </div>
    ) : (
      <DelegationCard delegations={[]} />
    ),
  };

  return (
    <ProjectWorkbenchShell
      conversation={children({ runSteering, composerBanner })}
      panels={panels}
      status={presentation.status}
      statusDetail={presentation.detail}
      selectedPane={preferences.selectedPane}
      onSelectedPaneChange={preferences.setSelectedPane}
      dockCollapsed={preferences.dockCollapsed}
      onDockCollapsedChange={preferences.setDockCollapsed}
      dockWidth={preferences.dockWidth}
      onDockWidthChange={preferences.setDockWidth}
      runControls={runControls}
    />
  );
}
