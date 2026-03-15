import {
	createCommandActionHandler,
	createReadFileActionHandler,
	executeAgentLoop as executeSharedAgentLoop,
	parseAgentDecision,
	type AgentActionContext,
	type AgentLoopState,
	type AgentMessage,
} from "@assistant/agent-core";

import { buildSummary } from "../commands";
import { throwIfAborted } from "../cancellation";
import {
	MAX_CONSECUTIVE_DECISION_FAILURES,
	MAX_AGENT_STEPS,
	MAX_OBSERVATION_CHARS,
	MAX_RECOVERY_REPLANS,
	MODEL_RETRY_OPTIONS,
} from "./constants";
import { buildAgentKickoffPrompt, buildAgentSystemPrompt } from "./prompts";
import type { ExecuteAgentLoopParams } from "./types";
import {
	handleReadFileAction,
	handleReadFilesAction,
	handleRunCommandAction,
	handleRunParallelAction,
	handleRunScriptAction,
} from "./agent-loop-actions";

interface SandboxAgentLoopState extends AgentLoopState {
	commandCount: number;
	consecutiveCommandFailures: number;
}

interface SandboxAgentSharedContext {
	sandbox: ExecuteAgentLoopParams["sandbox"];
	repoTargetDir: string;
	readOnlyCommands: boolean;
	trustLevel: NonNullable<ExecuteAgentLoopParams["trustLevel"]>;
	executionLogs: string[];
	emit: ExecuteAgentLoopParams["emit"];
	approvalClient?: ExecuteAgentLoopParams["approvalClient"];
	abortSignal?: AbortSignal;
}

function toSandboxActionContext(
	context: AgentActionContext<SandboxAgentSharedContext, SandboxAgentLoopState>,
) {
	return {
		sandbox: context.shared.sandbox,
		repoTargetDir: context.shared.repoTargetDir,
		readOnlyCommands: context.shared.readOnlyCommands,
		trustLevel: context.shared.trustLevel,
		step: context.step,
		state: context.state,
		messages: context.messages,
		executionLogs: context.shared.executionLogs,
		emit: context.shared.emit,
		approvalClient: context.shared.approvalClient,
		abortSignal: context.shared.abortSignal,
		guardExecution: context.guardExecution,
		beginPlanRecovery: context.beginPlanRecovery,
	};
}

export async function executeAgentLoop(
	params: ExecuteAgentLoopParams,
): Promise<{ commandCount: number; summary: string; finalPlan: string }> {
	const {
		sandbox,
		client,
		model,
		repoDisplayName,
		repoTargetDir,
		task,
		taskType,
		promptStrategy,
		initialPlan,
		repoContext,
		executionLogs,
		emit,
		approvalClient,
		abortSignal,
		checkpoint,
	} = params;

	const guardExecution = async (abortMessage: string) => {
		if (checkpoint) {
			await checkpoint(abortMessage);
			return;
		}
		throwIfAborted(abortSignal, abortMessage);
	};

	const readOnlyCommands =
		taskType === "code-review" || taskType === "test-suite";
	const trustLevel = params.trustLevel ?? "balanced";
	const messages: AgentMessage[] = [
		{
			role: "system",
			content: buildAgentSystemPrompt({
				repoTargetDir,
				promptStrategy,
				readOnlyCommands,
			}),
		},
		{
			role: "user",
			content: buildAgentKickoffPrompt({
				repoName: repoDisplayName,
				task,
				plan: initialPlan,
				repoContext,
				promptStrategy,
			}),
		},
	];

	const state: SandboxAgentLoopState = {
		commandCount: 0,
		consecutiveCommandFailures: 0,
	};

	const shared: SandboxAgentSharedContext = {
		sandbox,
		repoTargetDir,
		readOnlyCommands,
		trustLevel,
		executionLogs,
		emit,
		approvalClient,
		abortSignal,
	};

	const result = await executeSharedAgentLoop({
		initialMessages: messages,
		initialPlan,
		shared,
		state,
		guardExecution,
		emit,
		config: {
			maxSteps: MAX_AGENT_STEPS,
			maxConsecutiveDecisionFailures: MAX_CONSECUTIVE_DECISION_FAILURES,
			maxRecoveryReplans: MAX_RECOVERY_REPLANS,
			maxObservationChars: MAX_OBSERVATION_CHARS,
		},
		getCommandCount: (runtimeState) => runtimeState.commandCount,
		resolveDecision: async ({ messages: currentMessages }) => {
			const decisionResponse = await client.chatCompletion(
				{
					messages: currentMessages.map((message) => ({
						role: message.role,
						content:
							typeof message.content === "string"
								? message.content
								: JSON.stringify(message.content),
					})),
					model,
				},
				MODEL_RETRY_OPTIONS,
			);

			return {
				rawResponse: decisionResponse,
				decision: parseAgentDecision(decisionResponse),
			};
		},
		handlers: [
			createReadFileActionHandler<
				SandboxAgentSharedContext,
				SandboxAgentLoopState
			>({
				onReadFile: async (decision, context) => {
					await handleReadFileAction(toSandboxActionContext(context), decision);
				},
				onReadFiles: async (decision, context) => {
					await handleReadFilesAction(
						toSandboxActionContext(context),
						decision,
					);
				},
			}),
			createCommandActionHandler<
				SandboxAgentSharedContext,
				SandboxAgentLoopState
			>({
				onRunCommand: async (decision, context) => {
					await handleRunCommandAction(
						toSandboxActionContext(context),
						decision,
					);
				},
				onRunParallel: async (decision, context) => {
					await handleRunParallelAction(
						toSandboxActionContext(context),
						decision,
					);
				},
				onRunScript: async (decision, context) => {
					await handleRunScriptAction(
						toSandboxActionContext(context),
						decision,
					);
				},
			}),
		],
		onPlanRecovery: ({ state: runtimeState }) => {
			runtimeState.consecutiveCommandFailures = 0;
		},
		buildSummary: ({ decision, state: runtimeState }) => {
			return (
				decision.summary.trim() ||
				buildSummary(
					task,
					repoDisplayName,
					runtimeState.commandCount,
					undefined,
					taskType,
				)
			);
		},
		formatRecoveryRequiredMessage: (recoveryReason) =>
			[
				"Execution has entered recovery mode.",
				"First action must be update_plan with a corrected, safer command strategy.",
				`Recovery reason: ${recoveryReason}`,
			].join("\n"),
	});

	return {
		commandCount: result.commandCount,
		summary: result.summary,
		finalPlan: result.finalPlan,
	};
}
