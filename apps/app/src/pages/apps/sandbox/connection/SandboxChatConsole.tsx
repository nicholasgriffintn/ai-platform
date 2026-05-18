import { SandboxChatComposer } from "./SandboxChatComposer";
import { SandboxTranscript } from "./SandboxTranscript";
import type { SandboxRunConsoleState } from "./useSandboxRunConsole";

interface SandboxChatConsoleProps {
	consoleState: SandboxRunConsoleState;
}

export function SandboxChatConsole({ consoleState: c }: SandboxChatConsoleProps) {
	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="min-h-0 flex-1 overflow-hidden">
				<SandboxTranscript
					messages={c.messages}
					timeline={c.timeline}
					selectedRun={c.selectedRun}
					isSelectedRunLoading={c.isSelectedRunLoading}
					targetRunId={c.targetRunId}
					selectedRunError={c.selectedRunError}
					latestPlan={c.latestPlan}
					pendingApprovals={c.pendingApprovals}
					approvals={c.approvals}
					approvalsRunId={c.approvalsRunId}
					isInstructionsLoading={c.isInstructionsLoading}
					instructionsError={c.instructionsError}
					isResolvePending={c.isInstructionPending}
					isSubmitting={c.isSubmitting}
					timelineEndRef={c.timelineEndRef}
					onResolveApproval={(approval, status) => void c.handleResolveApproval(approval, status)}
				/>
			</div>
			<div className="border-t border-zinc-200 bg-off-white/95 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/95">
				<div className="mx-auto max-w-3xl">
					<SandboxChatComposer
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
						instructionRunId={c.instructionRunId}
						operatorMessage={c.operatorMessage}
						setOperatorMessage={c.setOperatorMessage}
						isPausePending={c.isPausePending}
						isResumePending={c.isResumePending}
						isCancelPending={c.isCancelPending}
						isInstructionPending={c.isInstructionPending}
						onRunTask={() => void c.handleRunTask()}
						onPauseRun={() => void c.handlePauseRun()}
						onResumeRun={() => void c.handleResumeRun()}
						onCancelRun={() => void c.handleCancelRun()}
						onSubmitInstruction={(kind) => void c.handleSubmitInstruction(kind)}
					/>
				</div>
			</div>
		</div>
	);
}
