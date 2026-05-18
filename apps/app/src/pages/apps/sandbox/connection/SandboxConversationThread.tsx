import { type FormEvent, useCallback, useEffect, useMemo, useRef } from "react";

import { ChatInput, type ChatInputHandle } from "~/components/ConversationThread/ChatInput";
import { MessageList } from "~/components/ConversationThread/MessageList";
import { UsageLimitWarning } from "~/components/ConversationThread/UsageLimitWarning";
import { WelcomeScreen } from "~/components/ConversationThread/WelcomeScreen";
import { useChatStore } from "~/state/stores/chatStore";
import { SandboxChatControls } from "./SandboxChatControls";
import { buildSandboxDisplayMessages } from "./helpers";
import type { SandboxRunConsoleState } from "./useSandboxRunConsole";

interface SandboxConversationThreadProps {
	consoleState: SandboxRunConsoleState;
}

export function SandboxConversationThread({ consoleState: c }: SandboxConversationThreadProps) {
	const { chatInput, setChatInput, clearCurrentConversation } = useChatStore();
	const chatInputRef = useRef<ChatInputHandle>(null);
	const abortControllerRef = useRef(new AbortController());

	useEffect(() => {
		clearCurrentConversation();
	}, [clearCurrentConversation]);

	const displayMessages = useMemo(
		() =>
			buildSandboxDisplayMessages({
				messages: c.messages,
				timeline: c.timeline,
				selectedRun: c.selectedRun,
				latestPlan: c.latestPlan,
			}),
		[c.latestPlan, c.messages, c.selectedRun, c.timeline],
	);

	const handleSubmit = useCallback(
		async (event: FormEvent) => {
			event.preventDefault();
			const content = chatInput.trim();
			if (!content) return;

			setChatInput("");
			if (c.instructionRunId) {
				await c.submitInstruction(content);
			} else {
				await c.runTask(content);
			}
			setTimeout(() => chatInputRef.current?.focus(), 0);
		},
		[c, chatInput, setChatInput],
	);

	const showWelcomeScreen = displayMessages.length === 0 && !c.targetRunId && !c.isSubmitting;

	return (
		<div className="flex h-[calc(100%-3rem)] w-full flex-col">
			{showWelcomeScreen ? (
				<div className="flex flex-1 items-center justify-center">
					<WelcomeScreen
						setInput={setChatInput}
						title="What should the sandbox work on?"
						description="Choose a repository, describe the task, and the sandbox worker will stream progress back into this chat."
					/>
				</div>
			) : (
				<div className="flex-1 px-4">
					<div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-8">
						<MessageList messages={displayMessages} isSharedView />
					</div>
				</div>
			)}

			<div className="px-4 pt-2">
				<div className="mx-auto max-w-3xl">
					<UsageLimitWarning />
					<ChatInput
						ref={chatInputRef}
						handleSubmit={handleSubmit}
						isLoading={false}
						streamStarted={false}
						controller={abortControllerRef.current}
						onTranscribe={(data) => setChatInput(data.response.content)}
						placeholder={{
							newConversation: "Ask the sandbox to implement, review, test, or fix something...",
							followUp: c.instructionRunId
								? "Message the running sandbox agent..."
								: "Ask the sandbox to run a new task...",
						}}
						controls={
							<SandboxChatControls
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
								shouldCommit={c.shouldCommit}
								setShouldCommit={c.setShouldCommit}
								isReadOnlyTaskType={c.isReadOnlyTaskType}
								disabled={c.isSubmitting && !c.instructionRunId}
								activeRunId={c.runControlRunId}
								liveRunStatus={c.runControlStatus}
								commandProgress={c.commandProgress}
								pendingApprovals={c.pendingApprovals}
								isPausePending={c.isPausePending}
								isResumePending={c.isResumePending}
								isCancelPending={c.isCancelPending}
								isResolvePending={c.isInstructionPending}
								onPause={c.handlePauseRun}
								onResume={c.handleResumeRun}
								onCancel={c.handleCancelRun}
								onResolveApproval={c.handleResolveApproval}
							/>
						}
						disableAttachments
						hideDefaultControls
					/>
				</div>
			</div>
		</div>
	);
}
