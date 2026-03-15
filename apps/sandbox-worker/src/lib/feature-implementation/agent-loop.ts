import { buildSummary } from "../commands";
import { throwIfAborted } from "../cancellation";
import {
	MAX_CONSECUTIVE_DECISION_FAILURES,
	MAX_AGENT_STEPS,
	MAX_OBSERVATION_CHARS,
	MAX_RECOVERY_REPLANS,
	MODEL_RETRY_OPTIONS,
} from "./constants";
import { parseAgentDecision } from "./decision";
import { buildAgentKickoffPrompt, buildAgentSystemPrompt } from "./prompts";
import type { ExecuteAgentLoopParams } from "./types";
import { truncateForModel } from "./utils";
import {
	type AgentMessage,
	handleReadFileAction,
	handleReadFilesAction,
	handleRunCommandAction,
	handleRunParallelAction,
	handleRunScriptAction,
} from "./agent-loop-actions";

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

	let currentPlan = initialPlan;
	const state = {
		commandCount: 0,
		consecutiveCommandFailures: 0,
	};
	let consecutiveDecisionFailures = 0;
	let recoveryReplans = 0;
	let requiresPlanRecovery = false;
	let recoveryReason: string | undefined;

	const beginPlanRecovery = (reason: string) => {
		recoveryReplans += 1;
		if (recoveryReplans > MAX_RECOVERY_REPLANS) {
			throw new Error(
				`Agent exhausted recovery replans (${MAX_RECOVERY_REPLANS})`,
			);
		}
		requiresPlanRecovery = true;
		recoveryReason = truncateForModel(reason, MAX_OBSERVATION_CHARS);
		state.consecutiveCommandFailures = 0;
		consecutiveDecisionFailures = 0;
	};

	for (let step = 1; step <= MAX_AGENT_STEPS; step += 1) {
		await guardExecution("Sandbox run cancelled during agent execution");

		await emit({
			type: "agent_step_started",
			agentStep: step,
			commandCount: state.commandCount,
		});

		let decisionResponse = "";
		let decision: ReturnType<typeof parseAgentDecision>;
		try {
			decisionResponse = await client.chatCompletion(
				{
					messages,
					model,
				},
				MODEL_RETRY_OPTIONS,
			);
			decision = parseAgentDecision(decisionResponse);
			consecutiveDecisionFailures = 0;
		} catch (error) {
			consecutiveDecisionFailures += 1;
			const errorMessage =
				error instanceof Error
					? error.message
					: "Failed to parse or produce an agent decision";
			await emit({
				type: "agent_decision_invalid",
				agentStep: step,
				error: truncateForModel(errorMessage, MAX_OBSERVATION_CHARS),
				message: truncateForModel(decisionResponse, 600),
			});
			messages.push({
				role: "user",
				content: [
					"Your previous response could not be used as a valid decision.",
					`Error: ${truncateForModel(errorMessage, MAX_OBSERVATION_CHARS)}`,
					"Respond with exactly one JSON object using a supported action.",
					"If uncertain, use update_plan first to revise the next steps.",
				].join("\n"),
			});

			if (
				consecutiveDecisionFailures >= MAX_CONSECUTIVE_DECISION_FAILURES &&
				!requiresPlanRecovery
			) {
				beginPlanRecovery(
					`Model produced ${MAX_CONSECUTIVE_DECISION_FAILURES} unusable decisions in a row.`,
				);
				messages.push({
					role: "user",
					content: [
						"Execution has entered recovery mode.",
						"First action must be update_plan with a corrected, safer command strategy.",
						`Recovery reason: ${recoveryReason}`,
					].join("\n"),
				});
			}
			continue;
		}

		if (requiresPlanRecovery && decision.action !== "update_plan") {
			await emit({
				type: "agent_decision_invalid",
				agentStep: step,
				error: "Recovery mode requires update_plan before other actions.",
				action: decision.action,
			});
			messages.push({
				role: "user",
				content: [
					"Recovery mode is active after recent failures.",
					`Recovery reason: ${recoveryReason ?? "Repeated execution failures."}`,
					"Before any other action, return update_plan with a revised approach and safer next steps.",
				].join("\n"),
			});
			continue;
		}

		await emit({
			type: "agent_decision",
			agentStep: step,
			action: decision.action,
			reasoning: decision.reasoning,
		});

		messages.push({
			role: "assistant",
			content: JSON.stringify(decision),
		});

		const actionContext = {
			sandbox,
			repoTargetDir,
			readOnlyCommands,
			trustLevel,
			step,
			state,
			messages,
			executionLogs,
			emit,
			approvalClient,
			abortSignal,
			guardExecution,
			beginPlanRecovery,
		};

		switch (decision.action) {
			case "update_plan": {
				currentPlan = truncateForModel(decision.plan, 2500);
				requiresPlanRecovery = false;
				recoveryReason = undefined;
				await emit({
					type: "plan_updated",
					agentStep: step,
					plan: currentPlan,
				});
				messages.push({
					role: "user",
					content: [
						"Plan updated.",
						"",
						"Current plan:",
						currentPlan,
						"",
						"Choose the next action.",
					].join("\n"),
				});
				break;
			}
			case "read_file": {
				await handleReadFileAction(actionContext, decision);
				break;
			}
			case "read_files": {
				await handleReadFilesAction(actionContext, decision);
				break;
			}
			case "run_command": {
				await handleRunCommandAction(actionContext, decision);
				break;
			}
			case "run_parallel": {
				await handleRunParallelAction(actionContext, decision);
				break;
			}
			case "run_script": {
				await handleRunScriptAction(actionContext, decision);
				break;
			}
			case "finish": {
				const summary =
					decision.summary.trim() ||
					buildSummary(
						task,
						repoDisplayName,
						state.commandCount,
						undefined,
						taskType,
					);
				await emit({
					type: "agent_finished",
					agentStep: step,
					commandCount: state.commandCount,
					plan: truncateForModel(currentPlan, 1000),
					summary,
				});
				return {
					commandCount: state.commandCount,
					summary,
					finalPlan: currentPlan,
				};
			}
		}
	}

	throw new Error(`Agent exceeded maximum step budget (${MAX_AGENT_STEPS})`);
}
