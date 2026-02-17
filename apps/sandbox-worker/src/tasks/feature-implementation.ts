import { getSandbox } from "@cloudflare/sandbox";

import {
	execOrThrow,
	execOrThrowRedacted,
	resolveGitHubRepo,
	buildSummary,
	truncateLog,
	quoteForShell,
	buildCommitMessage,
} from "../lib/commands";
import { classifySandboxError } from "../lib/errors";
import {
	DEFAULT_MODEL,
	MAX_COMMANDS,
	MODEL_RETRY_OPTIONS,
} from "../lib/feature-implementation/constants";
import { collectRepositoryContext } from "../lib/feature-implementation/context";
import { executeAgentLoop } from "../lib/feature-implementation/agent-loop";
import { buildPlanningPrompt } from "../lib/feature-implementation/prompts";
import { truncateForModel } from "../lib/feature-implementation/utils";
import { PolychatClient } from "../lib/polychat-client";
import type {
	TaskEvent,
	TaskEventEmitter,
	TaskParams,
	TaskResult,
	TaskSecrets,
	Env,
} from "../types";

export async function executeFeatureImplementation(
	params: TaskParams,
	secrets: TaskSecrets,
	env: Env,
	emitEvent?: TaskEventEmitter,
): Promise<TaskResult> {
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

	const sandbox = getSandbox(env.Sandbox, crypto.randomUUID().slice(0, 8));
	const client = new PolychatClient(params.polychatApiUrl, secrets.userToken);
	const executionLogs: string[] = [];
	let branchName: string | undefined;
	const runId = params.runId;

	try {
		await emit({
			type: "task_started",
			task: params.task,
			repo: params.repo,
			model: params.model || DEFAULT_MODEL,
			installationId: params.installationId,
			polychatUri: params.polychatApiUrl,
		});

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

		const repoContext = await collectRepositoryContext({
			sandbox,
			repoTargetDir: repo.targetDir,
		});
		await emit({
			type: "repo_context_collected",
			message: `Collected repository context from ${repoContext.files.length} files`,
			taskInstructionSource: repoContext.taskInstructionSource,
			hasTaskInstructions: Boolean(repoContext.taskInstructions),
			hasPrdInstructions: repoContext.taskInstructionSource === "prd",
		});

		await emit({
			type: "planning_started",
			message: "Creating implementation plan",
		});

		const plan = await client.chatCompletion(
			{
				messages: [
					{
						role: "user",
						content: buildPlanningPrompt({
							repoName: repo.displayName,
							task,
							repoContext,
						}),
					},
				],
				model,
			},
			MODEL_RETRY_OPTIONS,
		);

		await emit({
			type: "planning_completed",
			plan: truncateForModel(plan, 1500),
		});
		await emit({
			type: "command_batch_ready",
			commandTotal: MAX_COMMANDS,
			message: "Agent command budget initialised",
		});

		const loopResult = await executeAgentLoop({
			sandbox,
			client,
			model,
			repoDisplayName: repo.displayName,
			repoTargetDir: repo.targetDir,
			task,
			initialPlan: plan,
			repoContext,
			executionLogs,
			emit,
		});

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

		const summary =
			loopResult.summary ||
			buildSummary(task, repo.displayName, loopResult.commandCount, branchName);

		return {
			success: true,
			logs: truncateLog(executionLogs.join("\n")),
			diff,
			branchName,
			summary,
		};
	} catch (error) {
		const classified = classifySandboxError(error);
		await emit({
			type: "task_failed",
			error: classified.message,
			errorType: classified.type,
			retryable: classified.retryable,
		});
		return {
			success: false,
			logs: truncateLog(executionLogs.join("\n")),
			branchName,
			error: classified.message,
			errorType: classified.type,
		};
	} finally {
		await sandbox.destroy();
	}
}
