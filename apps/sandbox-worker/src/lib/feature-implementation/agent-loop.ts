import {
	assertSafeCommand,
	buildSummary,
	formatCommandResult,
	getCommandRiskLevel,
	quoteForShell,
} from "../commands";
import { throwIfAborted } from "../cancellation";
import { resolveCommandApproval } from "./command-approval";

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

	type AgentMessage = {
		role: "system" | "user" | "assistant";
		content: string;
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
	let commandCount = 0;
	let consecutiveCommandFailures = 0;

	for (let step = 1; step <= MAX_AGENT_STEPS; step += 1) {
		await guardExecution("Sandbox run cancelled during agent execution");

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
				await guardExecution("Sandbox run cancelled before command execution");

				if (commandCount >= MAX_COMMANDS) {
					throw new Error(
						`Agent exceeded maximum command budget (${MAX_COMMANDS})`,
					);
				}

				const riskLevel = getCommandRiskLevel(decision.command);
				const approval = await resolveCommandApproval({
					command: decision.command,
					riskLevel,
					trustLevel,
					agentStep: step,
					emit,
					approvalClient,
					abortSignal,
					guardExecution,
				});
				if (approval.rejected) {
					messages.push({
						role: "user",
						content: [
							`Command approval was not granted for: ${decision.command}.`,
							approval.rejectedMessage ?? "No decision details provided.",
							"Choose a safer alternative command or continue with read_file/update_plan.",
						].join(" "),
					});
					break;
				}

				assertSafeCommand(decision.command, {
					readOnly: readOnlyCommands,
					trustLevel,
					allowNetwork: approval.allowNetwork,
					allowRisky: approval.allowRisky,
				});
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
				await guardExecution("Sandbox run cancelled after command execution");
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
			case "run_script": {
				await guardExecution("Sandbox run cancelled before script execution");

				if (readOnlyCommands || trustLevel === "strict") {
					messages.push({
						role: "user",
						content:
							"Scripts are not allowed in this run mode. Use run_command or read_file instead.",
					});
					break;
				}

				if (commandCount >= MAX_COMMANDS) {
					throw new Error(
						`Agent exceeded maximum command budget (${MAX_COMMANDS})`,
					);
				}

				commandCount += 1;
				const scriptLanguage = decision.language ?? "python";
				await emit({
					type: "script_started",
					code: truncateForModel(decision.code, 2000),
					language: scriptLanguage,
					agentStep: step,
					commandIndex: commandCount,
					commandTotal: MAX_COMMANDS,
				});

				const execution = await sandbox.runCode(decision.code, {
					language: scriptLanguage,
				});

				await guardExecution("Sandbox run cancelled after script execution");

				const scriptStdout = execution.logs?.stdout?.join("\n") ?? "";
				const scriptStderr = execution.logs?.stderr?.join("\n") ?? "";
				const scriptOutput = [scriptStdout, scriptStderr]
					.filter(Boolean)
					.join("\n");

				executionLogs.push(
					`[script:${scriptLanguage}]\n${truncateForModel(decision.code, 1000)}\n---\n${truncateForModel(scriptOutput, MAX_OBSERVATION_CHARS)}`,
				);

				if (execution.error) {
					consecutiveCommandFailures += 1;
					const errorMessage =
						execution.error.message || "Script execution failed";
					await emit({
						type: "script_failed",
						agentStep: step,
						commandIndex: commandCount,
						commandTotal: MAX_COMMANDS,
						error: truncateForModel(errorMessage, MAX_OBSERVATION_CHARS),
					});

					const errorParts = [
						"Script execution failed.",
						`Error: ${truncateForModel(errorMessage, MAX_OBSERVATION_CHARS)}`,
					];
					if (execution.error.traceback) {
						const tracebackStr = Array.isArray(execution.error.traceback)
							? execution.error.traceback.join("\n")
							: String(execution.error.traceback);
						errorParts.push(
							`Traceback:\n${truncateForModel(tracebackStr, MAX_OBSERVATION_CHARS)}`,
						);
					}
					errorParts.push("Fix the issue or try a different approach.");

					messages.push({
						role: "user",
						content: errorParts.join("\n"),
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
					type: "script_completed",
					agentStep: step,
					commandIndex: commandCount,
					commandTotal: MAX_COMMANDS,
				});

				messages.push({
					role: "user",
					content: [
						"Script executed successfully.",
						"Output:",
						"```",
						truncateForModel(scriptOutput, MAX_OBSERVATION_CHARS),
						"```",
					].join("\n"),
				});
				break;
			}
			case "finish": {
				const summary =
					decision.summary.trim() ||
					buildSummary(
						task,
						repoDisplayName,
						commandCount,
						undefined,
						taskType,
					);
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
