import { getSandbox } from "@cloudflare/sandbox";

import { PolychatClient } from "../lib/polychat-client";
import type { TaskParams, TaskResult, Env } from "../types";

// TODO: Add streaming back: https://developers.cloudflare.com/sandbox/guides/streaming-output/

export async function executeFeatureImplementation(
	params: TaskParams,
	env: Env,
): Promise<TaskResult> {
	const sandbox = getSandbox(env.Sandbox, crypto.randomUUID().slice(0, 8));
	const client = new PolychatClient(params.polychatApiUrl, params.userToken);

	try {
		if (!params.model) {
			params.model = "mistral-large";
		}

		const repoName = params.repo.split("/").pop() ?? "repo";
		await sandbox.gitCheckout(params.repo, { targetDir: repoName });

		if (params.shouldCommit) {
			const generatedBranchName = `polychat/feature-${Date.now()}`;
			await sandbox.exec(
				`cd ${repoName} && git checkout ${generatedBranchName}`,
			);
		}

		const planPrompt =
			`Implement this feature in the repository: ${params.task}\n\n` +
			`First, analyse the codebase structure. Then provide a step-by-step plan with specific commands.`;

		const plan = await client.chatCompletion({
			messages: [{ role: "user", content: planPrompt }],
			model: params.model,
		});

		const implPrompt =
			`Based on this plan:\n${plan}\n\n` +
			`Provide the exact commands and code changes needed. Format as shell commands.`;

		const implementation = await client.chatCompletion({
			messages: [{ role: "user", content: implPrompt }],
			model: params.model,
		});

		const commands = extractCommands(implementation);
		let logs = "";

		// TODO: We probably want to use the methods to manage files: https://developers.cloudflare.com/sandbox/guides/manage-files/
		for (const cmd of commands) {
			const result = await sandbox.exec(`cd ${repoName} && ${cmd}`);
			logs += `$ ${cmd}\n${result.stdout}\n${result.stderr}\n`;
		}

		const diffResult = await sandbox.exec(`cd ${repoName} && git diff`);
		const diff = diffResult.stdout;

		if (params.shouldCommit) {
			await sandbox.exec('cd repo && git config user.name "Polychat Bot"');
			await sandbox.exec('cd repo && git config user.email "bot@polychat.app"');
			// TODO: Work out the commit message based on the implementation details
			await sandbox.exec("cd repo && git add .");
			await sandbox.exec(
				'cd repo && git commit -m "Implement feature: ${params.task}"',
			);
		}

		return {
			success: true,
			logs,
			diff,
			summary: `Implemented: ${params.task}`,
		};
	} catch (error) {
		return {
			success: false,
			logs: "",
			error: String(error),
		};
	}
}

function extractCommands(text: string): string[] {
	// TODO: work out how to extract the commands
	return [];
}
