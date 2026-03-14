import type { SandboxWebhookCommand } from "@assistant/schemas";

export interface ParsedSandboxCommand {
	command: SandboxWebhookCommand;
	task: string;
}

function normaliseCommandName(
	value: string | undefined,
): SandboxWebhookCommand | null {
	if (!value) {
		return null;
	}

	const candidate = value.trim().toLowerCase().replace(/^\//, "");
	switch (candidate) {
		case "implement":
		case "review":
		case "test":
		case "fix":
			return candidate;
		default:
			return null;
	}
}

export function extractSandboxCommand(
	text: string,
): ParsedSandboxCommand | null {
	const match = text.match(/^\s*\/(implement|review|test|fix)\b([\s\S]*)$/im);
	if (!match) {
		return null;
	}

	const command = normaliseCommandName(match[1]);
	if (!command) {
		return null;
	}

	return {
		command,
		task: (match[2] || "").trim(),
	};
}

export function extractSandboxPushCommand(
	commitMessage: string,
): ParsedSandboxCommand | null {
	const slashCommand = extractSandboxCommand(commitMessage);
	if (slashCommand) {
		return slashCommand;
	}

	const inlineMatch = commitMessage.match(
		/\[sandbox\s+(implement|review|test|fix)(?::\s*([^\]]+))?\]/i,
	);
	if (!inlineMatch) {
		return null;
	}

	const command = normaliseCommandName(inlineMatch[1]);
	if (!command) {
		return null;
	}

	return {
		command,
		task: (inlineMatch[2] || "").trim(),
	};
}

export function getSandboxDynamicAppId(command: SandboxWebhookCommand): string {
	switch (command) {
		case "review":
			return "run_code_review";
		case "test":
			return "run_test_suite";
		case "fix":
			return "run_bug_fix";
		case "implement":
		default:
			return "run_feature_implementation";
	}
}

export function defaultTaskForSandboxCommand(
	command: SandboxWebhookCommand,
): string {
	switch (command) {
		case "review":
			return "Review the repository and report correctness, security, and testing risks.";
		case "test":
			return "Run the repository's relevant test suites and report failures.";
		case "fix":
			return "Diagnose and fix the reported bug, then validate with tests.";
		case "implement":
		default:
			return "Implement the requested feature and validate with tests.";
	}
}

export function defaultShouldCommitForSandboxCommand(
	command: SandboxWebhookCommand,
): boolean {
	return command === "implement" || command === "fix";
}

export function extractImplementTask(commentBody: string): string | null {
	const parsed = extractSandboxCommand(commentBody);
	if (!parsed || parsed.command !== "implement") {
		return null;
	}

	return parsed.task || null;
}
