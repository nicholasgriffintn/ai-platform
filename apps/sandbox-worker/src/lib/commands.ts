import { getSandbox } from "@cloudflare/sandbox";
import type { SandboxTaskType } from "@assistant/schemas";

const MAX_LOG_CHARS = 80000;

const GITHUB_HTTPS_REPO_REGEX =
	/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i;
const GITHUB_SLUG_REPO_REGEX =
	/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/;

const FORBIDDEN_COMMAND_PATTERNS: RegExp[] = [
	/\brm\s+-rf\s+\/(?:\s|$)/i,
	/\b(sudo|shutdown|reboot|mkfs|dd)\b/i,
	/\b(curl|wget)\b[^\n]*\|/i,
	/\bgit\s+push\b/i,
];

const READ_ONLY_MUTATING_PATTERNS: RegExp[] = [
	/\bgit\s+(add|commit|merge|rebase|cherry-pick|reset|checkout|switch|restore|clean|stash|tag|branch|push|pull)\b/i,
	/\b(rm|mv|cp|mkdir|rmdir|touch|truncate|chmod|chown)\b/i,
	/\b(npm|pnpm|yarn|bun)\s+(install|add|remove|update)\b/i,
	/\b(pip|pip3|poetry)\s+(install|add|remove)\b/i,
	/\b(?:sed|perl)\s+-i\b/i,
];

type SandboxInstance = ReturnType<typeof getSandbox>;

interface RepoInfo {
	displayName: string;
	targetDir: string;
	checkoutUrl: string;
	checkoutAuthHeader?: string;
}

export async function execOrThrow(
	sandbox: SandboxInstance,
	command: string,
	logs: string[],
) {
	const result = await sandbox.exec(command);
	logs.push(formatCommandResult(command, result));
	if (!result.success) {
		throw new Error(result.stderr || `Command failed (${result.exitCode})`);
	}
}

export async function execOrThrowRedacted(
	sandbox: SandboxInstance,
	command: string,
	logs: string[],
	redactedCommand: string,
) {
	const result = await sandbox.exec(command);
	logs.push(formatCommandResult(redactedCommand, result));
	if (!result.success) {
		throw new Error(result.stderr || `Command failed (${result.exitCode})`);
	}
}

export function resolveGitHubRepo(
	repo: string,
	githubToken?: string,
): RepoInfo {
	const trimmedRepo = repo.trim();
	if (!trimmedRepo) {
		throw new Error("Repository is required");
	}

	const httpsMatch = trimmedRepo.match(GITHUB_HTTPS_REPO_REGEX);
	const slugMatch = trimmedRepo.match(GITHUB_SLUG_REPO_REGEX);

	const owner = httpsMatch?.[1] ?? slugMatch?.[1];
	const repoName = httpsMatch?.[2] ?? slugMatch?.[2];
	if (!owner || !repoName) {
		throw new Error(
			"Repository must be a GitHub repo in the format owner/repo or https://github.com/owner/repo",
		);
	}

	const safeName = repoName.replace(/\.git$/i, "");
	const displayName = `${owner}/${safeName}`;
	const targetDir = safeName.replace(/[^A-Za-z0-9_.-]/g, "-");

	const checkoutUrl = `https://github.com/${displayName}.git`;
	const checkoutAuthHeader = githubToken
		? `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${githubToken}`).toString("base64")}`
		: undefined;

	return {
		displayName,
		targetDir,
		checkoutUrl,
		checkoutAuthHeader,
	};
}

export function normaliseCommandLine(rawLine: string): string | null {
	let line = rawLine.trim();
	if (!line || line === "```" || line.startsWith("#")) {
		return null;
	}

	line = line
		.replace(/^\$\s*/, "")
		.replace(/^[-*]\s+/, "")
		.replace(/^\d+\.\s+/, "")
		.trim();

	if (!line || line.toLowerCase().startsWith("cd ")) {
		return null;
	}

	if (
		(line.startsWith("`") && line.endsWith("`")) ||
		(line.startsWith('"') && line.endsWith('"'))
	) {
		line = line.slice(1, -1).trim();
	}

	if (!line || !/^[./A-Za-z]/.test(line)) {
		return null;
	}

	return line;
}

export function assertSafeCommand(
	command: string,
	options?: { readOnly?: boolean },
) {
	if (command.length > 500) {
		throw new Error("Command is too long");
	}
	if (command.includes("\n") || command.includes("\r")) {
		throw new Error(`Command contains unexpected newlines: ${command}`);
	}
	if (/&&|\|\||;|\|/.test(command) || /(^|\s)&(\s|$)/.test(command)) {
		throw new Error(`Command contains blocked shell operators: ${command}`);
	}
	if (/\$\(|`/.test(command)) {
		throw new Error(`Command contains blocked shell evaluation: ${command}`);
	}
	for (const pattern of FORBIDDEN_COMMAND_PATTERNS) {
		if (pattern.test(command)) {
			throw new Error(`Command is blocked by sandbox policy: ${command}`);
		}
	}
	if (options?.readOnly) {
		for (const pattern of READ_ONLY_MUTATING_PATTERNS) {
			if (pattern.test(command)) {
				throw new Error(`Command is blocked in read-only mode: ${command}`);
			}
		}
	}
}

export function formatCommandResult(
	command: string,
	result: { exitCode: number; stdout: string; stderr: string },
): string {
	const output = [result.stdout.trim(), result.stderr.trim()]
		.filter(Boolean)
		.join("\n");
	return [`$ ${command}`, `exit_code=${result.exitCode}`, output]
		.filter(Boolean)
		.join("\n");
}

export function buildCommitMessage(task: string): string {
	const normalisedTask = task.replace(/\s+/g, " ").trim().slice(0, 72);
	return `feat: ${normalisedTask}`;
}

export function buildSummary(
	task: string,
	repo: string,
	commandCount: number,
	branchName?: string,
	taskType: SandboxTaskType = "feature-implementation",
): string {
	if (taskType === "code-review") {
		return `Completed code review for "${task}" in ${repo} with ${commandCount} commands.`;
	}
	if (taskType === "test-suite") {
		return `Completed test suite run for "${task}" in ${repo} with ${commandCount} commands.`;
	}
	if (taskType === "bug-fix") {
		if (branchName) {
			return `Completed bug fix "${task}" in ${repo} with ${commandCount} commands on branch ${branchName}.`;
		}
		return `Completed bug fix "${task}" in ${repo} with ${commandCount} commands.`;
	}
	if (taskType === "refactoring") {
		if (branchName) {
			return `Completed refactoring "${task}" in ${repo} with ${commandCount} commands on branch ${branchName}.`;
		}
		return `Completed refactoring "${task}" in ${repo} with ${commandCount} commands.`;
	}
	if (taskType === "documentation") {
		if (branchName) {
			return `Completed documentation update "${task}" in ${repo} with ${commandCount} commands on branch ${branchName}.`;
		}
		return `Completed documentation update "${task}" in ${repo} with ${commandCount} commands.`;
	}
	if (taskType === "migration") {
		if (branchName) {
			return `Completed migration "${task}" in ${repo} with ${commandCount} commands on branch ${branchName}.`;
		}
		return `Completed migration "${task}" in ${repo} with ${commandCount} commands.`;
	}

	if (branchName) {
		return `Implemented "${task}" in ${repo} with ${commandCount} commands on branch ${branchName}.`;
	}

	return `Implemented "${task}" in ${repo} with ${commandCount} commands.`;
}

export function truncateLog(logs: string): string {
	if (logs.length <= MAX_LOG_CHARS) {
		return logs;
	}

	return `${logs.slice(0, MAX_LOG_CHARS)}\n... (truncated)`;
}

export function quoteForShell(value: string): string {
	return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export function extractCommands(text: string): string[] {
	const commands: string[] = [];
	const codeBlocks = Array.from(
		text.matchAll(/```(?:bash|sh|shell)?\s*([\s\S]*?)```/gi),
		(match) => match[1],
	);
	const source = codeBlocks.length > 0 ? codeBlocks.join("\n") : text;

	for (const rawLine of source.split("\n")) {
		const command = normaliseCommandLine(rawLine);
		if (!command) {
			continue;
		}
		if (!commands.includes(command)) {
			commands.push(command);
		}
	}

	return commands;
}
