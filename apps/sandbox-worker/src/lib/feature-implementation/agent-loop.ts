import {
	assertSafeCommand,
	buildSummary,
	formatCommandResult,
	quoteForShell,
} from "../commands";
import { throwIfAborted } from "../cancellation";

import {
	MAX_COMMANDS,
	MAX_CONSECUTIVE_COMMAND_FAILURES,
	MAX_AGENT_STEPS,
	MAX_OBSERVATION_CHARS,
	MODEL_RETRY_OPTIONS,
} from "./constants";
import { parseAgentDecision } from "./decision";
import { readRepositoryFileSnippet } from "./context";
import {
	buildAgentKickoffPrompt,
	buildAgentSystemPrompt,
	formatCommandObservation,
	formatReadObservation,
} from "./prompts";
import type { ExecuteAgentLoopParams } from "./types";
import { truncateForModel } from "./utils";

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
		promptStrategy,
		initialPlan,
		repoContext,
		executionLogs,
		emit,
		abortSignal,
	} = params;

	type AgentMessage = {
		role: "system" | "user" | "assistant";
		content: string;
	};
	const messages: AgentMessage[] = [
		{
			role: "system",
			content: buildAgentSystemPrompt({
				repoTargetDir,
				promptStrategy,
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
	let commandCount = 0;
	let consecutiveCommandFailures = 0;

	for (let step = 1; step <= MAX_AGENT_STEPS; step += 1) {
		throwIfAborted(abortSignal, "Sandbox run cancelled during agent execution");

		await emit({
			type: "agent_step_started",
			agentStep: step,
			commandCount,
		});

		const decisionResponse = await client.chatCompletion(
			{
				messages,
				model,
			},
			MODEL_RETRY_OPTIONS,
		);
		const decision = parseAgentDecision(decisionResponse);
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

		switch (decision.action) {
			case "update_plan": {
				currentPlan = truncateForModel(decision.plan, 2500);
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
				const readResult = await readRepositoryFileSnippet({
					sandbox,
					repoTargetDir,
					path: decision.path,
					startLine: decision.startLine,
					endLine: decision.endLine,
				});
				await emit({
					type: "file_read",
					agentStep: step,
					path: readResult.path,
					startLine: readResult.startLine,
					endLine: readResult.endLine,
					truncated: readResult.truncated,
					error: readResult.error,
				});
				messages.push({
					role: "user",
					content: formatReadObservation(readResult),
				});
				break;
			}
			case "run_command": {
				throwIfAborted(
					abortSignal,
					"Sandbox run cancelled before command execution",
				);

				if (commandCount >= MAX_COMMANDS) {
					throw new Error(
						`Agent exceeded maximum command budget (${MAX_COMMANDS})`,
					);
				}

				assertSafeCommand(decision.command);
				commandCount += 1;
				await emit({
					type: "command_started",
					command: decision.command,
					commandIndex: commandCount,
					commandTotal: MAX_COMMANDS,
					agentStep: step,
				});

				const result = await sandbox.exec(
					`cd ${quoteForShell(repoTargetDir)} && ${decision.command}`,
				);
				throwIfAborted(
					abortSignal,
					"Sandbox run cancelled after command execution",
				);
				executionLogs.push(formatCommandResult(decision.command, result));

				if (!result.success) {
					consecutiveCommandFailures += 1;
					const failureMessage =
						result.stderr || result.stdout || "Unknown command failure";
					await emit({
						type: "command_failed",
						command: decision.command,
						commandIndex: commandCount,
						commandTotal: MAX_COMMANDS,
						agentStep: step,
						exitCode: result.exitCode,
						error: truncateForModel(failureMessage, MAX_OBSERVATION_CHARS),
					});

					messages.push({
						role: "user",
						content: formatCommandObservation({
							command: decision.command,
							result,
						}),
					});

					if (consecutiveCommandFailures >= MAX_CONSECUTIVE_COMMAND_FAILURES) {
						throw new Error(
							`Agent reached ${MAX_CONSECUTIVE_COMMAND_FAILURES} consecutive command failures`,
						);
					}
					break;
				}

				consecutiveCommandFailures = 0;
				await emit({
					type: "command_completed",
					command: decision.command,
					commandIndex: commandCount,
					commandTotal: MAX_COMMANDS,
					agentStep: step,
					exitCode: result.exitCode,
				});
				messages.push({
					role: "user",
					content: formatCommandObservation({
						command: decision.command,
						result,
					}),
				});
				break;
			}
			case "finish": {
				const summary =
					decision.summary.trim() ||
					buildSummary(task, repoDisplayName, commandCount);
				await emit({
					type: "agent_finished",
					agentStep: step,
					commandCount,
					plan: truncateForModel(currentPlan, 1000),
					summary,
				});
				return {
					commandCount,
					summary,
					finalPlan: currentPlan,
				};
			}
		}
	}

	throw new Error(`Agent exceeded maximum step budget (${MAX_AGENT_STEPS})`);
}
