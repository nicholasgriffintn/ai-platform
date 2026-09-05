import { RunChangesView, RunFilesView } from "@ngriffin_uk/polychat-component-content";
import { RunActivityPanel } from "@ngriffin_uk/polychat-component-conversation";
import {
  ProjectWorkbenchRunControls,
  ProjectWorkbenchPreview,
  ProjectWorkbenchRunPanel,
  ProjectWorkbenchServices,
  ProjectWorkbenchShell,
  type ProjectWorkbenchPane,
} from "@ngriffin_uk/polychat-component-workspaces";
import { buildAgentTraceEntries } from "@ngriffin_uk/polychat-library-chat/agent-trace";
import { buildRunActivityEntries } from "@ngriffin_uk/polychat-library-chat/run-activity";
import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { useMemo, type ReactNode } from "react";

import { useProjectWorkbenchControls } from "~/hooks/useProjectWorkbenchControls";
import { useProjectWorkbenchDiff } from "~/hooks/useProjectWorkbenchEvidence";
import { useProjectWorkbenchPreferences } from "~/hooks/useProjectWorkbenchPreferences";
import { useProjectWorkbenchPreview } from "~/hooks/useProjectWorkbenchPreview";
import { useProjectWorkbenchRuns } from "~/hooks/useProjectWorkbenchRuns";
import { getOutputArtifactContent } from "~/lib/api/outputs";
import { getErrorMessage } from "~/lib/errors";
import {
  deriveProjectWorkbenchControlState,
  deriveProjectWorkbenchPresentation,
  deriveProjectWorkbenchServices,
} from "~/lib/project-workbench";
import { formatProjectWorkbenchPreviewFeedback } from "~/lib/project-workbench-preview";
import { useChatStore } from "~/state/stores/chatStore";
import type { Message } from "~/types";

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
  children: ReactNode;
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
    events: runsQuery.currentRun?.events ?? [],
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
  const isWorkbenchEligible = hasCodingEnvironment || runsQuery.runs.length > 0;

  if (!hasCodingEnvironment && (runsQuery.isLoading || !isWorkbenchEligible)) {
    return children;
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
        instructions={controls.instructions}
        approvals={controls.approvals}
        isSubmittingInstruction={controls.isSubmittingInstruction}
        isUpdatingControl={controls.isUpdatingControl}
        errorMessage={controlsErrorMessage}
        onAddInstruction={controls.addInstruction}
        onContinue={controls.continueRun}
        onPause={controls.pauseRun}
        onResume={controls.resumeRun}
        onCancel={controls.cancelRun}
        onResolveApproval={controls.resolveApproval}
      />
    ) : undefined;
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
        <RunActivityPanel
          entries={activityEntries}
          isLoading={runsQuery.isLoading}
          errorMessage={errorMessage}
        />
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
  };

  return (
    <ProjectWorkbenchShell
      conversation={children}
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
