import {
	assertSafeCommand,
	extractCommands,
	formatCommandResult,
	quoteForShell,
} from "../commands";
import { throwIfAborted } from "../cancellation";

import { MAX_OBSERVATION_CHARS } from "./constants";
import type {
	QualityGateCheckResult,
	QualityGateResult,
	SandboxExecInstance,
} from "./types";
import { truncateForModel } from "./utils";

const VALIDATION_COMMAND_PATTERN =
	/\b(test|tests|lint|typecheck|type-check|check|verify|validate|build|clippy|fmt)\b/i;
const MUTATION_COMMAND_PATTERN =
	/\b(git\s+(add|commit|push|checkout|switch|merge|rebase|reset)|npm\s+install|pnpm\s+install|yarn\s+install|bun\s+install|cargo\s+add|go\s+mod)\b/i;

function isValidationCommand(command: string): boolean {
	return VALIDATION_COMMAND_PATTERN.test(command);
}

function isMutationCommand(command: string): boolean {
	return MUTATION_COMMAND_PATTERN.test(command);
}

function toCheckName(command: string, index: number): string {
	const firstToken = command.trim().split(/\s+/)[0];
	if (!firstToken) {
		return `quality-check-${index + 1}`;
	}
	return `${firstToken}-check-${index + 1}`;
}

function toCheckOutput(stdout: string, stderr: string): string {
	const combinedOutput = [stdout.trim(), stderr.trim()]
		.filter(Boolean)
		.join("\n");
	return truncateForModel(combinedOutput, MAX_OBSERVATION_CHARS);
}

export function deriveQualityGateCommands(params: {
	plans: string[];
	maxCommands?: number;
}): string[] {
	const { plans } = params;
	const maxCommands = Math.max(1, params.maxCommands ?? 5);
	const commands: string[] = [];
	const seenCommands = new Set<string>();

	for (const plan of plans) {
		for (const command of extractCommands(plan)) {
			const normalisedCommand = command.trim();
			if (!normalisedCommand || seenCommands.has(normalisedCommand)) {
				continue;
			}
			if (!isValidationCommand(normalisedCommand)) {
				continue;
			}
			if (isMutationCommand(normalisedCommand)) {
				continue;
			}
			try {
				assertSafeCommand(normalisedCommand);
			} catch {
				continue;
			}

			seenCommands.add(normalisedCommand);
			commands.push(normalisedCommand);
			if (commands.length >= maxCommands) {
				return commands;
			}
		}
	}

	return commands;
}

export async function runQualityGate(params: {
	sandbox: SandboxExecInstance;
	repoTargetDir: string;
	commands: string[];
	executionLogs: string[];
	abortSignal?: AbortSignal;
	checkpoint?: (abortMessage: string) => Promise<void>;
	emit: (event: {
		type: string;
		command?: string;
		commandIndex?: number;
		commandTotal?: number;
		exitCode?: number;
		error?: string;
		message?: string;
	}) => Promise<void>;
}): Promise<QualityGateResult> {
	const {
		sandbox,
		repoTargetDir,
		commands,
		executionLogs,
		emit,
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

	await guardExecution("Sandbox run cancelled before quality gate");

	if (commands.length === 0) {
		await emit({
			type: "quality_gate_skipped",
			message: "No validation commands were found in the implementation plan",
		});
		return {
			passed: true,
			checks: [],
			summary:
				"Quality gate skipped because no validation commands were found.",
		};
	}

	await emit({
		type: "quality_gate_started",
		commandTotal: commands.length,
		message: "Running quality gate checks",
	});

	const checks: QualityGateCheckResult[] = [];
	for (const [index, command] of commands.entries()) {
		await guardExecution("Sandbox run cancelled during quality gate checks");

		await emit({
			type: "quality_gate_check_started",
			command,
			commandIndex: index + 1,
			commandTotal: commands.length,
		});

		const result = await sandbox.exec(
			`cd ${quoteForShell(repoTargetDir)} && ${command}`,
		);
		await guardExecution("Sandbox run cancelled during quality gate checks");
		executionLogs.push(
			formatCommandResult(`[quality-gate] ${command}`, result),
		);

		const check: QualityGateCheckResult = {
			name: toCheckName(command, index),
			command,
			passed: result.success,
			output: toCheckOutput(result.stdout, result.stderr),
		};
		checks.push(check);

		if (result.success) {
			await emit({
				type: "quality_gate_check_passed",
				command,
				commandIndex: index + 1,
				commandTotal: commands.length,
				exitCode: result.exitCode,
			});
			continue;
		}

		const failureMessage =
			result.stderr || result.stdout || "Validation command failed";
		await emit({
			type: "quality_gate_check_failed",
			command,
			commandIndex: index + 1,
			commandTotal: commands.length,
			exitCode: result.exitCode,
			error: truncateForModel(failureMessage, MAX_OBSERVATION_CHARS),
		});
	}

	const failedChecks = checks.filter((check) => !check.passed);
	const passed = failedChecks.length === 0;
	const summary = passed
		? `Quality gate passed (${checks.length}/${checks.length} checks passed).`
		: `Quality gate failed (${checks.length - failedChecks.length}/${checks.length} checks passed).`;

	await emit({
		type: "quality_gate_completed",
		message: summary,
	});

	return {
		passed,
		checks,
		summary,
	};
}
