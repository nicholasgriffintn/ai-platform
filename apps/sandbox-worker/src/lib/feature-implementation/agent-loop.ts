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
	MAX_CONSECUTIVE_DECISION_FAILURES,
	MAX_AGENT_STEPS,
	MAX_OBSERVATION_CHARS,
	MAX_PARALLEL_COMMANDS,
	MAX_RECOVERY_REPLANS,
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
		consecutiveCommandFailures = 0;
		consecutiveDecisionFailures = 0;
	};

	for (let step = 1; step <= MAX_AGENT_STEPS; step += 1) {
		await guardExecution("Sandbox run cancelled during agent execution");

		await emit({
			type: "agent_step_started",
			agentStep: step,
			commandCount,
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

				try {
					assertSafeCommand(decision.command, {
						readOnly: readOnlyCommands,
						trustLevel,
						allowNetwork: approval.allowNetwork,
						allowRisky: approval.allowRisky,
					});
				} catch (error) {
					consecutiveCommandFailures += 1;
					const errorMessage =
						error instanceof Error
							? error.message
							: "Command blocked by sandbox policy";
					await emit({
						type: "command_failed",
						command: decision.command,
						commandTotal: MAX_COMMANDS,
						agentStep: step,
						error: truncateForModel(errorMessage, MAX_OBSERVATION_CHARS),
					});
					messages.push({
						role: "user",
						content: [
							`Command blocked: ${decision.command}`,
							`Error: ${truncateForModel(errorMessage, MAX_OBSERVATION_CHARS)}`,
							"Choose a single safe command without shell chaining, pipes, or substitution.",
						].join("\n"),
					});
					if (consecutiveCommandFailures >= MAX_CONSECUTIVE_COMMAND_FAILURES) {
						beginPlanRecovery(
							`Command policy/validation failed ${MAX_CONSECUTIVE_COMMAND_FAILURES} times in a row. Last error: ${truncateForModel(errorMessage, 600)}`,
						);
						messages.push({
							role: "user",
							content: [
								"Multiple command attempts were blocked.",
								"Use update_plan now to revise the execution strategy before trying another action.",
							].join("\n"),
						});
					}
					break;
				}
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
						beginPlanRecovery(
							`Command execution failed ${MAX_CONSECUTIVE_COMMAND_FAILURES} times in a row. Last failure: ${truncateForModel(failureMessage, 600)}`,
						);
						messages.push({
							role: "user",
							content: [
								"Commands have failed repeatedly.",
								"Use update_plan to revise the approach with safer, more targeted steps before running more commands.",
							].join("\n"),
						});
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
			case "run_parallel": {
				await guardExecution(
					"Sandbox run cancelled before parallel command execution",
				);

				const requestedCommands = decision.commands
					.map((entry) => entry.trim())
					.filter(Boolean);
				if (!requestedCommands.length) {
					messages.push({
						role: "user",
						content:
							"run_parallel requires at least one non-empty command. Use update_plan or provide valid commands.",
					});
					break;
				}

				const commands = requestedCommands.slice(0, MAX_PARALLEL_COMMANDS);
				if (commandCount + commands.length > MAX_COMMANDS) {
					throw new Error(
						`Agent exceeded maximum command budget (${MAX_COMMANDS})`,
					);
				}

				let blockedCommand: { command: string; error: string } | null = null;
				for (const command of commands) {
					try {
						assertSafeCommand(command, {
							readOnly: true,
							trustLevel,
							allowNetwork: false,
							allowRisky: false,
						});
					} catch (error) {
						blockedCommand = {
							command,
							error:
								error instanceof Error
									? error.message
									: "Command blocked by sandbox policy",
						};
						break;
					}
				}

				if (blockedCommand) {
					consecutiveCommandFailures += 1;
					await emit({
						type: "command_failed",
						command: blockedCommand.command,
						commandTotal: MAX_COMMANDS,
						agentStep: step,
						error: truncateForModel(
							blockedCommand.error,
							MAX_OBSERVATION_CHARS,
						),
					});
					messages.push({
						role: "user",
						content: [
							`Parallel command blocked: ${blockedCommand.command}`,
							`Error: ${truncateForModel(blockedCommand.error, MAX_OBSERVATION_CHARS)}`,
							"run_parallel supports safe read-only commands only. Revise with update_plan before retrying.",
						].join("\n"),
					});
					if (consecutiveCommandFailures >= MAX_CONSECUTIVE_COMMAND_FAILURES) {
						beginPlanRecovery(
							`Parallel command validation failed ${MAX_CONSECUTIVE_COMMAND_FAILURES} times in a row. Last error: ${truncateForModel(blockedCommand.error, 600)}`,
						);
					}
					break;
				}

				const firstCommandIndex = commandCount + 1;
				commandCount += commands.length;

				for (let index = 0; index < commands.length; index += 1) {
					await emit({
						type: "command_started",
						command: commands[index],
						commandIndex: firstCommandIndex + index,
						commandTotal: MAX_COMMANDS,
						agentStep: step,
					});
				}

				const results = await Promise.all(
					commands.map((command) =>
						sandbox.exec(`cd ${quoteForShell(repoTargetDir)} && ${command}`),
					),
				);
				await guardExecution(
					"Sandbox run cancelled after parallel command execution",
				);

				let failedCount = 0;
				const observationParts: string[] = [];
				for (let index = 0; index < commands.length; index += 1) {
					const command = commands[index];
					const result = results[index];
					const commandIndex = firstCommandIndex + index;
					executionLogs.push(formatCommandResult(command, result));
					observationParts.push(
						formatCommandObservation({
							command,
							result,
						}),
					);
					if (!result.success) {
						failedCount += 1;
						const failureMessage =
							result.stderr || result.stdout || "Unknown command failure";
						await emit({
							type: "command_failed",
							command,
							commandIndex,
							commandTotal: MAX_COMMANDS,
							agentStep: step,
							exitCode: result.exitCode,
							error: truncateForModel(failureMessage, MAX_OBSERVATION_CHARS),
						});
						continue;
					}

					await emit({
						type: "command_completed",
						command,
						commandIndex,
						commandTotal: MAX_COMMANDS,
						agentStep: step,
						exitCode: result.exitCode,
					});
				}

				if (failedCount > 0) {
					consecutiveCommandFailures += failedCount;
					const failureLine =
						failedCount === 1
							? "1 command failed in the parallel batch."
							: `${failedCount} commands failed in the parallel batch.`;
					messages.push({
						role: "user",
						content: [
							failureLine,
							"Review outputs and revise with update_plan before retrying.",
							...observationParts,
						].join("\n\n"),
					});
					if (consecutiveCommandFailures >= MAX_CONSECUTIVE_COMMAND_FAILURES) {
						beginPlanRecovery(
							`Parallel commands produced repeated failures. Failed commands in last batch: ${failedCount}.`,
						);
					}
					break;
				}

				consecutiveCommandFailures = 0;
				const truncationLine =
					requestedCommands.length > commands.length
						? `Only the first ${MAX_PARALLEL_COMMANDS} commands were executed.`
						: "";
				messages.push({
					role: "user",
					content: [
						`Parallel command batch succeeded (${commands.length} commands).`,
						truncationLine,
						...observationParts,
					]
						.filter(Boolean)
						.join("\n\n"),
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
				const scriptLanguage = decision.language ?? "javascript";
				await emit({
					type: "script_started",
					code: truncateForModel(decision.code, 2000),
					language: scriptLanguage,
					agentStep: step,
					commandIndex: commandCount,
					commandTotal: MAX_COMMANDS,
				});

				let execution: Awaited<ReturnType<typeof sandbox.runCode>>;
				try {
					execution = await sandbox.runCode(decision.code, {
						language: scriptLanguage,
					});
				} catch (error) {
					consecutiveCommandFailures += 1;
					const errorMessage =
						error instanceof Error ? error.message : "Script execution failed";
					await emit({
						type: "script_failed",
						agentStep: step,
						commandIndex: commandCount,
						commandTotal: MAX_COMMANDS,
						error: truncateForModel(errorMessage, MAX_OBSERVATION_CHARS),
					});

					messages.push({
						role: "user",
						content: [
							"Script execution failed.",
							`Error: ${truncateForModel(errorMessage, MAX_OBSERVATION_CHARS)}`,
							"Use javascript/typescript run_script, run_command, or read_file instead.",
						].join("\n"),
					});

					if (consecutiveCommandFailures >= MAX_CONSECUTIVE_COMMAND_FAILURES) {
						beginPlanRecovery(
							`Script execution threw ${MAX_CONSECUTIVE_COMMAND_FAILURES} times in a row. Last error: ${truncateForModel(errorMessage, 600)}`,
						);
						messages.push({
							role: "user",
							content: [
								"Script attempts are failing repeatedly.",
								"Use update_plan now to choose a safer next approach before further execution.",
							].join("\n"),
						});
					}
					break;
				}

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
						beginPlanRecovery(
							`Script execution failed ${MAX_CONSECUTIVE_COMMAND_FAILURES} times in a row. Last error: ${truncateForModel(errorMessage, 600)}`,
						);
						messages.push({
							role: "user",
							content: [
								"Script execution has failed repeatedly.",
								"Use update_plan with a revised strategy before attempting more commands or scripts.",
							].join("\n"),
						});
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
