import { AlertCircle } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { BackLink } from "~/components/Core/BackLink";
import { EmptyState } from "~/components/Core/EmptyState";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
import { Alert, AlertDescription, AlertTitle, Button } from "~/components/ui";
import { CommandApprovalsCard } from "./connection/CommandApprovalsCard";
import { ConversationCard } from "./connection/ConversationCard";
import { CurrentPlanCard } from "./connection/CurrentPlanCard";
import { LiveStreamCard } from "./connection/LiveStreamCard";
import { RunDetailsCard } from "./connection/RunDetailsCard";
import { RunHistoryCard } from "./connection/RunHistoryCard";
import { RunTaskForm } from "./connection/RunTaskForm";
import { useSandboxRunConsole } from "./connection/useSandboxRunConsole";

export function meta() {
	return [
		{ title: "Sandbox Run Console - Polychat" },
		{
			name: "description",
			content:
				"Run sandbox tasks against a connected GitHub repository and follow streamed command progress.",
		},
	];
}

export default function SandboxConnectionPage() {
	const navigate = useNavigate();
	const c = useSandboxRunConsole();

	if (!c.hasValidInstallationId) {
		return (
			<PageShell
				sidebarContent={<AppsSidebarContent />}
				className="max-w-7xl mx-auto"
			>
				<Alert variant="destructive">
					<AlertTitle>Invalid connection id</AlertTitle>
					<AlertDescription>
						The sandbox connection URL is invalid. Return to{" "}
						<Link to="/apps/sandbox" className="underline">
							Sandbox Worker
						</Link>
						.
					</AlertDescription>
				</Alert>
			</PageShell>
		);
	}

	return (
		<PageShell
			sidebarContent={<AppsSidebarContent />}
			className="max-w-7xl mx-auto"
			headerContent={
				<PageHeader>
					<BackLink to="/apps/sandbox" label="Back to Sandbox Worker" />
					<PageTitle title={`Installation ${c.installationId}`} />
					<p className="text-sm text-muted-foreground">
						Submit sandbox tasks and stream command-level progress from the
						sandbox worker.
					</p>
				</PageHeader>
			}
		>
			{c.isLoading ? (
				<div className="text-sm text-muted-foreground">
					Loading connection...
				</div>
			) : c.error ? (
				<Alert variant="destructive">
					<AlertTitle>Unable to load connection</AlertTitle>
					<AlertDescription>
						{c.error instanceof Error ? c.error.message : "Unknown error"}
					</AlertDescription>
				</Alert>
			) : !c.connection ? (
				<EmptyState
					icon={<AlertCircle className="h-8 w-8 text-zinc-400" />}
					title="Connection not found"
					message="This installation is not available in your account."
					action={
						<Button variant="primary" onClick={() => navigate("/apps/sandbox")}>
							Back to sandbox
						</Button>
					}
					className="min-h-[360px]"
				/>
			) : (
				<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
					<div className="space-y-6">
						<RunTaskForm
							repo={c.repo}
							setRepo={c.setRepo}
							repoSuggestions={c.repoSuggestions}
							normalisedRepo={c.normalisedRepo}
							model={c.model}
							setModel={c.setModel}
							taskType={c.taskType}
							setTaskType={c.setTaskType}
							promptStrategy={c.promptStrategy}
							setPromptStrategy={c.setPromptStrategy}
							timeoutSecondsInput={c.timeoutSecondsInput}
							setTimeoutSecondsInput={c.setTimeoutSecondsInput}
							hasValidTimeout={c.hasValidTimeout}
							task={c.task}
							setTask={c.setTask}
							shouldCommit={c.shouldCommit}
							setShouldCommit={c.setShouldCommit}
							isReadOnlyTaskType={c.isReadOnlyTaskType}
							isSubmitting={c.isSubmitting}
							canSubmit={c.canSubmit}
							commandProgress={c.commandProgress}
							liveRunStatus={c.liveRunStatus}
							activeRunId={c.activeRunId}
							isPausePending={c.isPausePending}
							isResumePending={c.isResumePending}
							isCancelPending={c.isCancelPending}
							onRunTask={() => void c.handleRunTask()}
							onPauseRun={() => void c.handlePauseRun()}
							onResumeRun={() => void c.handleResumeRun()}
							onCancelRun={() => void c.handleCancelRun()}
							appId={c.connection.appId}
						/>

						<CurrentPlanCard
							latestPlan={c.latestPlan}
							planTasks={c.planTasks}
						/>

						<ConversationCard
							messages={c.messages}
							instructionRunId={c.instructionRunId}
							operatorMessage={c.operatorMessage}
							setOperatorMessage={c.setOperatorMessage}
							isInstructionPending={c.isInstructionPending}
							onSubmitInstruction={(kind) =>
								void c.handleSubmitInstruction(kind)
							}
						/>

						<LiveStreamCard
							timeline={c.timeline}
							isSubmitting={c.isSubmitting}
							selectedRun={c.selectedRun}
							timelineEndRef={c.timelineEndRef}
						/>
					</div>

					<div className="space-y-6">
						<CommandApprovalsCard
							approvals={c.approvals}
							pendingApprovals={c.pendingApprovals}
							approvalsRunId={c.approvalsRunId}
							isInstructionsLoading={c.isInstructionsLoading}
							instructionsError={c.instructionsError}
							isResolvePending={c.isInstructionPending}
							onResolveApproval={(approval, status) =>
								void c.handleResolveApproval(approval, status)
							}
						/>

						<RunDetailsCard
							selectedRun={c.selectedRun}
							isSelectedRunLoading={c.isSelectedRunLoading}
							targetRunId={c.targetRunId}
							selectedRunError={c.selectedRunError}
						/>

						<RunHistoryCard
							runs={c.runs}
							isRunsLoading={c.isRunsLoading}
							runsError={c.runsError}
							targetRunId={c.targetRunId}
							onSelectRun={c.setSelectedRunInUrl}
						/>
					</div>
				</div>
			)}
		</PageShell>
	);
}
