import { getSandbox } from "@cloudflare/sandbox";

import { PolychatClient } from "../lib/polychat-client";
import type {
	TaskEventEmitter,
	TaskEvent,
	TaskParams,
	TaskResult,
	TaskSecrets,
	Env,
} from "../types";
import {
	execOrThrow,
	execOrThrowRedacted,
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
	secrets: TaskSecrets,
	env: Env,
	emitEvent?: TaskEventEmitter,
): Promise<TaskResult> {
	const sandbox = getSandbox(env.Sandbox, crypto.randomUUID().slice(0, 8));
	const client = new PolychatClient(params.polychatApiUrl, secrets.userToken);
	const executionLogs: string[] = [];
	let branchName: string | undefined;
	const runId = params.runId;
	const emit = async (event: TaskEvent) => {
		if (!emitEvent) {
			return;
		}
		const nextEvent: TaskEvent = {
			...event,
			type: event.type,
			runId: typeof event.runId === "string" ? (event.runId as string) : runId,
		};
		await emitEvent(nextEvent);
	};

	try {
		const task = params.task.trim();
		if (!task) {
			throw new Error("Task is required");
		}

		const model = params.model || DEFAULT_MODEL;
		const repo = resolveGitHubRepo(params.repo, secrets.githubToken);
		await emit({
			type: "repo_clone_started",
			repo: repo.displayName,
			installationId: params.installationId,
		});

		if (repo.checkoutAuthHeader) {
			await execOrThrowRedacted(
				sandbox,
				`git -c http.extraHeader=${quoteForShell(repo.checkoutAuthHeader)} clone --depth 1 ${quoteForShell(repo.checkoutUrl)} ${quoteForShell(repo.targetDir)}`,
				executionLogs,
				`git clone --depth 1 ${quoteForShell(repo.checkoutUrl)} ${quoteForShell(repo.targetDir)} [auth header redacted]`,
			);
		} else {
			await sandbox.gitCheckout(repo.checkoutUrl, {
				targetDir: repo.targetDir,
				depth: 1,
			});
		}
		await emit({
			type: "repo_clone_completed",
			repo: repo.displayName,
			targetDir: repo.targetDir,
		});

		if (params.shouldCommit) {
			branchName = `polychat/feature-${Date.now()}`;
			await execOrThrow(
				sandbox,
				`git -C ${quoteForShell(repo.targetDir)} checkout -b ${quoteForShell(branchName)}`,
				executionLogs,
			);
			await emit({
				type: "git_branch_created",
				branchName,
			});
		}

		await emit({
			type: "planning_started",
			message: "Creating implementation plan",
		});
		const planPrompt =
			`Implement this feature in the repository ${repo.displayName}: ${task}\n\n` +
			"First, analyse the current code and produce a concise implementation plan.";

		const plan = await client.chatCompletion({
			messages: [{ role: "user", content: planPrompt }],
			model,
		});
		await emit({
			type: "planning_completed",
			plan: plan.slice(0, 1000),
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
		await emit({
			type: "command_batch_ready",
			commandTotal: commands.length,
		});

		for (const [index, cmd] of commands.entries()) {
			assertSafeCommand(cmd);
			const commandIndex = index + 1;
			await emit({
				type: "command_started",
				command: cmd,
				commandIndex,
				commandTotal: commands.length,
			});

			const result = await sandbox.exec(
				`cd ${quoteForShell(repo.targetDir)} && ${cmd}`,
			);
			executionLogs.push(formatCommandResult(cmd, result));

			if (!result.success) {
				await emit({
					type: "command_failed",
					command: cmd,
					commandIndex,
					commandTotal: commands.length,
					exitCode: result.exitCode,
					error: result.stderr || result.stdout || "Unknown command failure",
				});
				throw new Error(
					`Command failed (${result.exitCode}): ${cmd}\n${result.stderr || result.stdout}`,
				);
			}
			await emit({
				type: "command_completed",
				command: cmd,
				commandIndex,
				commandTotal: commands.length,
				exitCode: result.exitCode,
			});
		}

		const diffResult = await sandbox.exec(
			`git -C ${quoteForShell(repo.targetDir)} diff --patch`,
		);
		if (!diffResult.success) {
			throw new Error(diffResult.stderr || "Failed to generate git diff");
		}
		const diff = diffResult.stdout;
		await emit({
			type: "diff_generated",
			hasChanges: diff.trim().length > 0,
		});

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
				await emit({
					type: "commit_created",
					branchName,
				});
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
