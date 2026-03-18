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
	MAX_COMMANDS,
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
	lastActionSignature?: string;
	repeatedActionCount: number;
	instructionCursor: number;
	pendingStepExtensions: number;
	autoStepExtensionsUsed: number;
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
		repeatedActionCount: 0,
		instructionCursor: 0,
		pendingStepExtensions: 0,
		autoStepExtensionsUsed: 0,
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

	const ingestOperatorInstructions = async (
		currentMessages: AgentMessage[],
		agentStep: number,
	): Promise<void> => {
		if (!approvalClient) {
			return;
		}

		const instructions = await approvalClient.listInstructions(
			state.instructionCursor,
			abortSignal,
		);
		if (!instructions.length) {
			return;
		}

		for (const envelope of instructions) {
			if (envelope.index <= state.instructionCursor) {
				continue;
			}
			state.instructionCursor = envelope.index;
			const instruction = envelope.instruction;
			if (instruction.kind !== "message" && instruction.kind !== "continue") {
				continue;
			}
			const content = instruction.content?.trim();

			if (instruction.kind === "continue") {
				state.pendingStepExtensions += 1;
			}

			if (content) {
				currentMessages.push({
					role: "user",
					content:
						instruction.kind === "continue"
							? `Operator requested continuation with guidance: ${content}`
							: `Operator message: ${content}`,
				});
			} else if (instruction.kind === "continue") {
				currentMessages.push({
					role: "user",
					content:
						"Operator requested continuation. Keep moving and prioritise finishing with clear validation.",
				});
			}

			await emit({
				type: "run_instruction_received",
				agentStep,
				instructionId: instruction.id,
				instructionKind: instruction.kind,
				instructionContent: content ? content.slice(0, 500) : undefined,
				message:
					instruction.kind === "continue"
						? "Continue instruction received by worker"
						: "Operator message received by worker",
			});
		}
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
		resolveDecision: async ({ messages: currentMessages, step }) => {
			await ingestOperatorInstructions(currentMessages, step);

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
			runtimeState.lastActionSignature = undefined;
			runtimeState.repeatedActionCount = 0;
		},
		onStepBudgetExceeded: async ({
			step,
			state: runtimeState,
			messages: currentMessages,
		}) => {
			await ingestOperatorInstructions(currentMessages, step);

			if (
				runtimeState.pendingStepExtensions > 0 &&
				runtimeState.commandCount < MAX_COMMANDS
			) {
				runtimeState.pendingStepExtensions -= 1;
				return {
					extendBy: 24,
					reason: "Continuing execution after operator instruction",
				};
			}

			if (
				runtimeState.autoStepExtensionsUsed < 1 &&
				runtimeState.commandCount > 0 &&
				runtimeState.commandCount < MAX_COMMANDS
			) {
				runtimeState.autoStepExtensionsUsed += 1;
				return {
					extendBy: 12,
					reason: "Applying one automatic extension to allow completion",
				};
			}

			return null;
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
