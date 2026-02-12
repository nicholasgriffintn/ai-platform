import { getSandbox } from "@cloudflare/sandbox";

import { PolychatClient } from "../lib/polychat-client";
import type { TaskParams, TaskResult, Env } from "../types";
import {
	execOrThrow,
	resolveGitHubRepo,
	extractCommands,
	assertSafeCommand,
	formatCommandResult,
	buildSummary,
	truncateLog,
	quoteForShell,
	buildCommitMessage,
} from "../lib/commands";

const DEFAULT_MODEL = "mistral-large";
const MAX_COMMANDS = 30;

export async function executeFeatureImplementation(
	params: TaskParams,
	env: Env,
): Promise<TaskResult> {
	const sandbox = getSandbox(env.Sandbox, crypto.randomUUID().slice(0, 8));
	const client = new PolychatClient(params.polychatApiUrl, params.userToken);
	const executionLogs: string[] = [];
	let branchName: string | undefined;

	try {
		const task = params.task.trim();
		if (!task) {
			throw new Error("Task is required");
		}

		const model = params.model || DEFAULT_MODEL;
		const repo = resolveGitHubRepo(params.repo, params.githubToken);

		await sandbox.gitCheckout(repo.checkoutUrl, {
			targetDir: repo.targetDir,
			depth: 1,
		});

		if (params.shouldCommit) {
			branchName = `polychat/feature-${Date.now()}`;
			await execOrThrow(
				sandbox,
				`git -C ${quoteForShell(repo.targetDir)} checkout -b ${quoteForShell(branchName)}`,
				executionLogs,
			);
		}

		const planPrompt =
			`Implement this feature in the repository ${repo.displayName}: ${task}\n\n` +
			"First, analyse the current code and produce a concise implementation plan.";

		const plan = await client.chatCompletion({
			messages: [{ role: "user", content: planPrompt }],
			model,
		});

		const implPrompt =
			`Based on this plan:\n${plan}\n\n` +
			"Return only shell commands in a single ```bash``` block.\n" +
			"Requirements: do not include explanations, do not include `cd`, and do not chain commands with `&&`, `||`, `;`, or pipes.";

		const implementation = await client.chatCompletion({
			messages: [{ role: "user", content: implPrompt }],
			model,
		});

		const commands = extractCommands(implementation).slice(0, MAX_COMMANDS);
		if (commands.length === 0) {
			throw new Error("No executable commands were returned by the model");
		}

		for (const cmd of commands) {
			assertSafeCommand(cmd);

			const result = await sandbox.exec(
				`cd ${quoteForShell(repo.targetDir)} && ${cmd}`,
			);
			executionLogs.push(formatCommandResult(cmd, result));

			if (!result.success) {
				throw new Error(
					`Command failed (${result.exitCode}): ${cmd}\n${result.stderr || result.stdout}`,
				);
			}
		}

		const diffResult = await sandbox.exec(
			`git -C ${quoteForShell(repo.targetDir)} diff --patch`,
		);
		if (!diffResult.success) {
			throw new Error(diffResult.stderr || "Failed to generate git diff");
		}
		const diff = diffResult.stdout;

		if (params.shouldCommit) {
			await execOrThrow(
				sandbox,
				`git -C ${quoteForShell(repo.targetDir)} config user.name ${quoteForShell("Polychat Bot")}`,
				executionLogs,
			);
			await execOrThrow(
				sandbox,
				`git -C ${quoteForShell(repo.targetDir)} config user.email ${quoteForShell("bot@polychat.app")}`,
				executionLogs,
			);
			await execOrThrow(
				sandbox,
				`git -C ${quoteForShell(repo.targetDir)} add -A`,
				executionLogs,
			);

			const stagedStatus = await sandbox.exec(
				`git -C ${quoteForShell(repo.targetDir)} diff --cached --quiet`,
			);
			if (stagedStatus.exitCode !== 0) {
				await execOrThrow(
					sandbox,
					`git -C ${quoteForShell(repo.targetDir)} commit -m ${quoteForShell(buildCommitMessage(task))}`,
					executionLogs,
				);
			}
		}

		return {
			success: true,
			logs: truncateLog(executionLogs.join("\n")),
			diff,
			branchName,
			summary: buildSummary(
				task,
				repo.displayName,
				commands.length,
				branchName,
			),
		};
	} catch (error) {
		return {
			success: false,
			logs: truncateLog(executionLogs.join("\n")),
			branchName,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}
