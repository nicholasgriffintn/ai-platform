import type { SandboxTrustLevel } from "@assistant/schemas";

import {
	assertSafeCommand,
	formatCommandResult,
	getCommandRiskLevel,
	quoteForShell,
} from "../commands";
import { resolveCommandApproval } from "./command-approval";
import {
	MAX_COMMANDS,
	MAX_CONSECUTIVE_COMMAND_FAILURES,
	MAX_OBSERVATION_CHARS,
	MAX_PARALLEL_COMMANDS,
	MAX_READ_FILES_BATCH,
} from "./constants";
import { readRepositoryFileSnippet } from "./context";
import { formatCommandObservation, formatReadObservation } from "./prompts";
import type {
	ExecuteAgentLoopParams,
	ReadFileDecision,
	ReadFilesDecision,
	RunCommandDecision,
	RunParallelDecision,
	RunScriptDecision,
} from "./types";
import { truncateForModel } from "./utils";

export type AgentMessage = {
	role: "system" | "user" | "assistant";
	content: string;
};

export interface AgentLoopMutableState {
	commandCount: number;
	consecutiveCommandFailures: number;
}

export interface AgentLoopActionContext {
	sandbox: ExecuteAgentLoopParams["sandbox"];
	repoTargetDir: string;
	readOnlyCommands: boolean;
	trustLevel: SandboxTrustLevel;
	step: number;
	state: AgentLoopMutableState;
	messages: AgentMessage[];
	executionLogs: string[];
	emit: ExecuteAgentLoopParams["emit"];
	approvalClient?: ExecuteAgentLoopParams["approvalClient"];
	abortSignal?: AbortSignal;
	guardExecution: (abortMessage: string) => Promise<void>;
	beginPlanRecovery: (reason: string) => void;
}

function pushUserMessage(messages: AgentMessage[], content: string) {
	messages.push({
		role: "user",
		content,
	});
}

export async function handleReadFileAction(
	context: AgentLoopActionContext,
	decision: ReadFileDecision,
): Promise<void> {
	const readResult = await readRepositoryFileSnippet({
		sandbox: context.sandbox,
		repoTargetDir: context.repoTargetDir,
		path: decision.path,
		startLine: decision.startLine,
		endLine: decision.endLine,
	});
	await context.emit({
		type: "file_read",
		agentStep: context.step,
		path: readResult.path,
		startLine: readResult.startLine,
		endLine: readResult.endLine,
		truncated: readResult.truncated,
		error: readResult.error,
	});
	pushUserMessage(context.messages, formatReadObservation(readResult));
}

export async function handleReadFilesAction(
	context: AgentLoopActionContext,
	decision: ReadFilesDecision,
): Promise<void> {
	const requestedFiles = decision.files.filter(
		(file) => typeof file.path === "string" && file.path.trim().length > 0,
	);
	if (!requestedFiles.length) {
		pushUserMessage(
			context.messages,
			"read_files requires at least one valid file target.",
		);
		return;
	}

	const files = requestedFiles.slice(0, MAX_READ_FILES_BATCH);
	const results = await Promise.all(
		files.map((target) =>
			readRepositoryFileSnippet({
				sandbox: context.sandbox,
				repoTargetDir: context.repoTargetDir,
				path: target.path,
				startLine: target.startLine,
				endLine: target.endLine,
			}),
		),
	);

	for (const result of results) {
		await context.emit({
			type: "file_read",
			agentStep: context.step,
			path: result.path,
			startLine: result.startLine,
			endLine: result.endLine,
			truncated: result.truncated,
			error: result.error,
		});
	}

	const truncatedLine =
		requestedFiles.length > files.length
			? `Only the first ${MAX_READ_FILES_BATCH} files were read in this batch.`
			: "";
	const observations = results
		.map(
			(result, index) =>
				`[File ${index + 1}/${results.length}]\n${formatReadObservation(result)}`,
		)
		.join("\n\n");

	pushUserMessage(
		context.messages,
		[
			`Completed read_files batch for ${results.length} files.`,
			truncatedLine,
			observations,
		]
			.filter(Boolean)
			.join("\n\n"),
	);
}

export async function handleRunCommandAction(
	context: AgentLoopActionContext,
	decision: RunCommandDecision,
): Promise<void> {
	await context.guardExecution(
		"Sandbox run cancelled before command execution",
	);

	if (context.state.commandCount >= MAX_COMMANDS) {
		throw new Error(`Agent exceeded maximum command budget (${MAX_COMMANDS})`);
	}

	const riskLevel = getCommandRiskLevel(decision.command);
	const approval = await resolveCommandApproval({
		command: decision.command,
		riskLevel,
		trustLevel: context.trustLevel,
		agentStep: context.step,
		emit: context.emit,
		approvalClient: context.approvalClient,
		abortSignal: context.abortSignal,
		guardExecution: context.guardExecution,
	});
	if (approval.rejected) {
		pushUserMessage(
			context.messages,
			[
				`Command approval was not granted for: ${decision.command}.`,
				approval.rejectedMessage ?? "No decision details provided.",
				"Choose a safer alternative command or continue with read_file/update_plan.",
			].join(" "),
		);
		return;
	}

	try {
		assertSafeCommand(decision.command, {
			readOnly: context.readOnlyCommands,
			trustLevel: context.trustLevel,
			allowNetwork: approval.allowNetwork,
			allowRisky: approval.allowRisky,
		});
	} catch (error) {
		context.state.consecutiveCommandFailures += 1;
		const errorMessage =
			error instanceof Error
				? error.message
				: "Command blocked by sandbox policy";
		await context.emit({
			type: "command_failed",
			command: decision.command,
			commandTotal: MAX_COMMANDS,
			agentStep: context.step,
			error: truncateForModel(errorMessage, MAX_OBSERVATION_CHARS),
		});
		pushUserMessage(
			context.messages,
			[
				`Command blocked: ${decision.command}`,
				`Error: ${truncateForModel(errorMessage, MAX_OBSERVATION_CHARS)}`,
				"Choose a single safe command without shell chaining, pipes, or substitution.",
			].join("\n"),
		);
		if (
			context.state.consecutiveCommandFailures >=
			MAX_CONSECUTIVE_COMMAND_FAILURES
		) {
			context.beginPlanRecovery(
				`Command policy/validation failed ${MAX_CONSECUTIVE_COMMAND_FAILURES} times in a row. Last error: ${truncateForModel(errorMessage, 600)}`,
			);
			pushUserMessage(
				context.messages,
				[
					"Multiple command attempts were blocked.",
					"Use update_plan now to revise the execution strategy before trying another action.",
				].join("\n"),
			);
		}
		return;
	}

	context.state.commandCount += 1;
	await context.emit({
		type: "command_started",
		command: decision.command,
		commandIndex: context.state.commandCount,
		commandTotal: MAX_COMMANDS,
		agentStep: context.step,
	});

	const result = await context.sandbox.exec(
		`cd ${quoteForShell(context.repoTargetDir)} && ${decision.command}`,
	);
	await context.guardExecution("Sandbox run cancelled after command execution");
	context.executionLogs.push(formatCommandResult(decision.command, result));

	if (!result.success) {
		context.state.consecutiveCommandFailures += 1;
		const failureMessage =
			result.stderr || result.stdout || "Unknown command failure";
		await context.emit({
			type: "command_failed",
			command: decision.command,
			commandIndex: context.state.commandCount,
			commandTotal: MAX_COMMANDS,
			agentStep: context.step,
			exitCode: result.exitCode,
			error: truncateForModel(failureMessage, MAX_OBSERVATION_CHARS),
		});

		pushUserMessage(
			context.messages,
			formatCommandObservation({
				command: decision.command,
				result,
			}),
		);

		if (
			context.state.consecutiveCommandFailures >=
			MAX_CONSECUTIVE_COMMAND_FAILURES
		) {
			context.beginPlanRecovery(
				`Command execution failed ${MAX_CONSECUTIVE_COMMAND_FAILURES} times in a row. Last failure: ${truncateForModel(failureMessage, 600)}`,
			);
			pushUserMessage(
				context.messages,
				[
					"Commands have failed repeatedly.",
					"Use update_plan to revise the approach with safer, more targeted steps before running more commands.",
				].join("\n"),
			);
		}
		return;
	}

	context.state.consecutiveCommandFailures = 0;
	await context.emit({
		type: "command_completed",
		command: decision.command,
		commandIndex: context.state.commandCount,
		commandTotal: MAX_COMMANDS,
		agentStep: context.step,
		exitCode: result.exitCode,
	});
	pushUserMessage(
		context.messages,
		formatCommandObservation({
			command: decision.command,
			result,
		}),
	);
}

export async function handleRunParallelAction(
	context: AgentLoopActionContext,
	decision: RunParallelDecision,
): Promise<void> {
	await context.guardExecution(
		"Sandbox run cancelled before parallel command execution",
	);

	const requestedCommands = decision.commands
		.map((entry) => entry.trim())
		.filter(Boolean);
	if (!requestedCommands.length) {
		pushUserMessage(
			context.messages,
			"run_parallel requires at least one non-empty command. Use update_plan or provide valid commands.",
		);
		return;
	}

	const commands = requestedCommands.slice(0, MAX_PARALLEL_COMMANDS);
	if (context.state.commandCount + commands.length > MAX_COMMANDS) {
		throw new Error(`Agent exceeded maximum command budget (${MAX_COMMANDS})`);
	}

	let blockedCommand: { command: string; error: string } | null = null;
	for (const command of commands) {
		try {
			assertSafeCommand(command, {
				readOnly: true,
				trustLevel: context.trustLevel,
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
		context.state.consecutiveCommandFailures += 1;
		await context.emit({
			type: "command_failed",
			command: blockedCommand.command,
			commandTotal: MAX_COMMANDS,
			agentStep: context.step,
			error: truncateForModel(blockedCommand.error, MAX_OBSERVATION_CHARS),
		});
		pushUserMessage(
			context.messages,
			[
				`Parallel command blocked: ${blockedCommand.command}`,
				`Error: ${truncateForModel(blockedCommand.error, MAX_OBSERVATION_CHARS)}`,
				"run_parallel supports safe read-only commands only. Revise with update_plan before retrying.",
			].join("\n"),
		);
		if (
			context.state.consecutiveCommandFailures >=
			MAX_CONSECUTIVE_COMMAND_FAILURES
		) {
			context.beginPlanRecovery(
				`Parallel command validation failed ${MAX_CONSECUTIVE_COMMAND_FAILURES} times in a row. Last error: ${truncateForModel(blockedCommand.error, 600)}`,
			);
		}
		return;
	}

	const firstCommandIndex = context.state.commandCount + 1;
	context.state.commandCount += commands.length;

	for (let index = 0; index < commands.length; index += 1) {
		await context.emit({
			type: "command_started",
			command: commands[index],
			commandIndex: firstCommandIndex + index,
			commandTotal: MAX_COMMANDS,
			agentStep: context.step,
		});
	}

	const results = await Promise.all(
		commands.map((command) =>
			context.sandbox.exec(
				`cd ${quoteForShell(context.repoTargetDir)} && ${command}`,
			),
		),
	);
	await context.guardExecution(
		"Sandbox run cancelled after parallel command execution",
	);

	let failedCount = 0;
	const observationParts: string[] = [];
	for (let index = 0; index < commands.length; index += 1) {
		const command = commands[index];
		const result = results[index];
		const commandIndex = firstCommandIndex + index;
		context.executionLogs.push(formatCommandResult(command, result));
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
			await context.emit({
				type: "command_failed",
				command,
				commandIndex,
				commandTotal: MAX_COMMANDS,
				agentStep: context.step,
				exitCode: result.exitCode,
				error: truncateForModel(failureMessage, MAX_OBSERVATION_CHARS),
			});
			continue;
		}

		await context.emit({
			type: "command_completed",
			command,
			commandIndex,
			commandTotal: MAX_COMMANDS,
			agentStep: context.step,
			exitCode: result.exitCode,
		});
	}

	if (failedCount > 0) {
		context.state.consecutiveCommandFailures += failedCount;
		const failureLine =
			failedCount === 1
				? "1 command failed in the parallel batch."
				: `${failedCount} commands failed in the parallel batch.`;
		pushUserMessage(
			context.messages,
			[
				failureLine,
				"Review outputs and revise with update_plan before retrying.",
				...observationParts,
			].join("\n\n"),
		);
		if (
			context.state.consecutiveCommandFailures >=
			MAX_CONSECUTIVE_COMMAND_FAILURES
		) {
			context.beginPlanRecovery(
				`Parallel commands produced repeated failures. Failed commands in last batch: ${failedCount}.`,
			);
		}
		return;
	}

	context.state.consecutiveCommandFailures = 0;
	const truncationLine =
		requestedCommands.length > commands.length
			? `Only the first ${MAX_PARALLEL_COMMANDS} commands were executed.`
			: "";
	pushUserMessage(
		context.messages,
		[
			`Parallel command batch succeeded (${commands.length} commands).`,
			truncationLine,
			...observationParts,
		]
			.filter(Boolean)
			.join("\n\n"),
	);
}

export async function handleRunScriptAction(
	context: AgentLoopActionContext,
	decision: RunScriptDecision,
): Promise<void> {
	await context.guardExecution("Sandbox run cancelled before script execution");

	if (context.readOnlyCommands || context.trustLevel === "strict") {
		pushUserMessage(
			context.messages,
			"Scripts are not allowed in this run mode. Use run_command or read_file instead.",
		);
		return;
	}

	if (context.state.commandCount >= MAX_COMMANDS) {
		throw new Error(`Agent exceeded maximum command budget (${MAX_COMMANDS})`);
	}

	context.state.commandCount += 1;
	const scriptLanguage = decision.language ?? "javascript";
	await context.emit({
		type: "script_started",
		code: truncateForModel(decision.code, 2000),
		language: scriptLanguage,
		agentStep: context.step,
		commandIndex: context.state.commandCount,
		commandTotal: MAX_COMMANDS,
	});

	let execution: Awaited<ReturnType<typeof context.sandbox.runCode>>;
	try {
		execution = await context.sandbox.runCode(decision.code, {
			language: scriptLanguage,
		});
	} catch (error) {
		context.state.consecutiveCommandFailures += 1;
		const errorMessage =
			error instanceof Error ? error.message : "Script execution failed";
		await context.emit({
			type: "script_failed",
			agentStep: context.step,
			commandIndex: context.state.commandCount,
			commandTotal: MAX_COMMANDS,
			error: truncateForModel(errorMessage, MAX_OBSERVATION_CHARS),
		});
		pushUserMessage(
			context.messages,
			[
				"Script execution failed.",
				`Error: ${truncateForModel(errorMessage, MAX_OBSERVATION_CHARS)}`,
				"Use javascript/typescript run_script, run_command, or read_file instead.",
			].join("\n"),
		);
		if (
			context.state.consecutiveCommandFailures >=
			MAX_CONSECUTIVE_COMMAND_FAILURES
		) {
			context.beginPlanRecovery(
				`Script execution threw ${MAX_CONSECUTIVE_COMMAND_FAILURES} times in a row. Last error: ${truncateForModel(errorMessage, 600)}`,
			);
			pushUserMessage(
				context.messages,
				[
					"Script attempts are failing repeatedly.",
					"Use update_plan now to choose a safer next approach before further execution.",
				].join("\n"),
			);
		}
		return;
	}

	await context.guardExecution("Sandbox run cancelled after script execution");

	const scriptStdout = execution.logs?.stdout?.join("\n") ?? "";
	const scriptStderr = execution.logs?.stderr?.join("\n") ?? "";
	const scriptOutput = [scriptStdout, scriptStderr].filter(Boolean).join("\n");

	context.executionLogs.push(
		`[script:${scriptLanguage}]\n${truncateForModel(decision.code, 1000)}\n---\n${truncateForModel(scriptOutput, MAX_OBSERVATION_CHARS)}`,
	);

	if (execution.error) {
		context.state.consecutiveCommandFailures += 1;
		const errorMessage = execution.error.message || "Script execution failed";
		await context.emit({
			type: "script_failed",
			agentStep: context.step,
			commandIndex: context.state.commandCount,
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

		pushUserMessage(context.messages, errorParts.join("\n"));

		if (
			context.state.consecutiveCommandFailures >=
			MAX_CONSECUTIVE_COMMAND_FAILURES
		) {
			context.beginPlanRecovery(
				`Script execution failed ${MAX_CONSECUTIVE_COMMAND_FAILURES} times in a row. Last error: ${truncateForModel(errorMessage, 600)}`,
			);
			pushUserMessage(
				context.messages,
				[
					"Script execution has failed repeatedly.",
					"Use update_plan with a revised strategy before attempting more commands or scripts.",
				].join("\n"),
			);
		}
		return;
	}

	context.state.consecutiveCommandFailures = 0;
	await context.emit({
		type: "script_completed",
		agentStep: context.step,
		commandIndex: context.state.commandCount,
		commandTotal: MAX_COMMANDS,
	});

	pushUserMessage(
		context.messages,
		[
			"Script executed successfully.",
			"Output:",
			"```",
			truncateForModel(scriptOutput, MAX_OBSERVATION_CHARS),
			"```",
		].join("\n"),
	);
}
