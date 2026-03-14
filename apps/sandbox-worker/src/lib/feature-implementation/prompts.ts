import {
	MAX_AGENT_STEPS,
	MAX_COMMANDS,
	MAX_OBSERVATION_CHARS,
	MAX_SNIPPET_CHARS,
} from "./constants";
import {
	formatPromptStrategyExamples,
	formatPromptStrategyFocus,
	type PromptStrategySelection,
} from "./prompt-strategy";
import type { ReadFileResult, RepositoryContext } from "./types";
import { truncateForModel } from "./utils";

function formatRepositoryContext(repoContext: RepositoryContext): string {
	const topLevelText = repoContext.topLevelEntries.length
		? repoContext.topLevelEntries.map((entry) => `- ${entry}`).join("\n")
		: "- (unable to detect top-level entries)";

	const filesText = repoContext.files.length
		? repoContext.files
				.map(
					(entry) =>
						`File: ${entry.path}\n\`\`\`\n${truncateForModel(entry.snippet, MAX_SNIPPET_CHARS)}\n\`\`\``,
				)
				.join("\n\n")
		: "No context files were detected.";

	const instructionText = repoContext.taskInstructions
		? `Found ${repoContext.taskInstructionSource.toUpperCase()} instructions in ${repoContext.taskInstructions.path}:\n\`\`\`\n${truncateForModel(repoContext.taskInstructions.snippet, MAX_SNIPPET_CHARS)}\n\`\`\``
		: "No task instruction files were found.";

	return [
		"Repository top-level entries:",
		topLevelText,
		"",
		"Detected file context snippets:",
		filesText,
		"",
		"Task instructions (PRD preferred):",
		instructionText,
	].join("\n");
}

function formatPromptStrategySection(
	promptStrategy: PromptStrategySelection,
): string {
	return [
		`Selected prompt strategy: ${promptStrategy.definition.label} (${promptStrategy.strategy})`,
		`Selection reason: ${promptStrategy.reason}`,
		"",
		"Planning focus:",
		formatPromptStrategyFocus(promptStrategy.definition, "planning"),
		"",
		"Good implementation examples to emulate:",
		formatPromptStrategyExamples(promptStrategy.definition),
	].join("\n");
}

export function buildPlanningPrompt(params: {
	repoName: string;
	task: string;
	repoContext: RepositoryContext;
	promptStrategy: PromptStrategySelection;
}): string {
	const { repoName, task, repoContext, promptStrategy } = params;
	const context = formatRepositoryContext(repoContext);
	const promptStrategySection = formatPromptStrategySection(promptStrategy);

	return [
		`You are planning a code implementation for repository ${repoName}.`,
		`Task: ${task}`,
		"",
		context,
		"",
		promptStrategySection,
		"",
		"Planning requirements:",
		"1. If PRD user stories exist, choose one passes=false story to implement first and cite its story id/title.",
		"2. Explain what files should be changed and why.",
		"3. Define key implementation steps and ordering.",
		"4. Include a 'Validation commands' section with one shell command per line (no chaining).",
		"5. Call out risks or assumptions to verify during execution.",
	].join("\n");
}

export function buildAgentSystemPrompt(params: {
	repoTargetDir: string;
	promptStrategy: PromptStrategySelection;
}): string {
	const { repoTargetDir, promptStrategy } = params;
	return [
		"You are an autonomous coding agent running inside a sandboxed shell.",
		`Repository root is '${repoTargetDir}'.`,
		`Selected prompt strategy: ${promptStrategy.definition.label} (${promptStrategy.strategy}).`,
		`Selection reason: ${promptStrategy.reason}`,
		"",
		"Execution focus:",
		formatPromptStrategyFocus(promptStrategy.definition, "execution"),
		"",
		"Respond with exactly one JSON object per message and no markdown.",
		"",
		"Allowed actions:",
		'- run_command: {"action":"run_command","command":"...","reasoning":"..."}',
		'- read_file: {"action":"read_file","path":"path/from/repo/root","startLine":1,"endLine":120,"reasoning":"..."}',
		'- update_plan: {"action":"update_plan","plan":"...","reasoning":"..."}',
		'- finish: {"action":"finish","summary":"...","reasoning":"..."}',
		"",
		"Rules for run_command:",
		"- Must be a single command.",
		"- Do not include cd.",
		"- Do not chain commands with &&, ||, ;, pipes, or command substitution.",
		"- Prefer safe inspection/edit/build/test commands.",
		"",
		"Use read_file when you need more context before deciding on commands.",
		"After each command result, adapt the next action based on the output.",
		"Use finish only when the task is implemented and validated, or when blocked with a clear reason.",
	].join("\n");
}

export function buildAgentKickoffPrompt(params: {
	repoName: string;
	task: string;
	plan: string;
	repoContext: RepositoryContext;
	promptStrategy: PromptStrategySelection;
}): string {
	const context = formatRepositoryContext(params.repoContext);

	return [
		`Repository: ${params.repoName}`,
		`Task: ${params.task}`,
		"",
		`Prompt strategy: ${params.promptStrategy.definition.label} (${params.promptStrategy.strategy})`,
		`Reason: ${params.promptStrategy.reason}`,
		"",
		"Current implementation plan:",
		params.plan,
		"",
		context,
		"",
		`Execution limits: max ${MAX_COMMANDS} commands and ${MAX_AGENT_STEPS} total agent steps.`,
		"Return the next best action as JSON.",
	].join("\n");
}

export function formatReadObservation(result: ReadFileResult): string {
	if (result.error) {
		return [
			`File read failed for ${result.path}.`,
			`Error: ${truncateForModel(result.error)}`,
			"Choose a different path or action.",
		].join("\n");
	}

	return [
		`Read file ${result.path} lines ${result.startLine}-${result.endLine}.`,
		result.truncated ? "Output was truncated." : "",
		"File contents:",
		"```",
		truncateForModel(result.content, MAX_OBSERVATION_CHARS),
		"```",
	]
		.filter(Boolean)
		.join("\n");
}

export function formatCommandObservation(params: {
	command: string;
	result: {
		exitCode: number;
		stdout: string;
		stderr: string;
		success: boolean;
	};
}): string {
	const { command, result } = params;

	return [
		`Command: ${command}`,
		`Success: ${result.success}`,
		`Exit code: ${result.exitCode}`,
		"STDOUT:",
		"```",
		truncateForModel(result.stdout.trim(), MAX_OBSERVATION_CHARS),
		"```",
		"STDERR:",
		"```",
		truncateForModel(result.stderr.trim(), MAX_OBSERVATION_CHARS),
		"```",
	].join("\n");
}
