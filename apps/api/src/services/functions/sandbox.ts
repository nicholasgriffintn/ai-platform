import type { IFunction } from "~/types";
import { generateJwtToken } from "~/services/auth/jwt";
import { getGithubConnectionToken } from "~/lib/github";

export const run_feature_implementation: IFunction = {
	name: "run_feature_implementation",
	description: "Implement a feature or fix in a GitHub repository using AI",
	type: "premium",
	costPerCall: 0.1,
	parameters: {
		type: "object",
		properties: {
			repo: {
				type: "string",
				description: "GitHub repository (format: owner/name)",
				pattern: "^[\\w.-]+/[\\w.-]+$",
			},
			task: {
				type: "string",
				description: "Feature to implement or bug to fix",
			},
			model: {
				type: "string",
				description: "Model to use (required if not configured in settings)",
			},
			shouldCommit: {
				type: "boolean",
				description:
					"Whether to create a commit inside the sandbox repository after applying changes",
			},
		},
		required: ["repo", "task"],
	},
	function: async (
		completion_id,
		args,
		request,
		app_url,
		conversationManager,
	) => {
		const { repo, task, model, shouldCommit } = args as {
			repo: string;
			task: string;
			model?: string;
			shouldCommit?: boolean;
		};

		if (!request.env.SANDBOX_WORKER) {
			throw new Error("Sandbox worker not available");
		}
		if (!request.context || !request.user) {
			throw new Error("User context is required for sandbox execution");
		}
		const context = request.context;
		const user = request.user;

		const settings = await context.repositories.userSettings.getUserSettings(
			user.id,
		);
		const selectedModel = model || settings?.sandbox_model;

		if (!selectedModel) {
			throw new Error(
				"No model specified. Provide a model or configure one in settings.",
			);
		}

		const expiresIn = 60 * 60;
		const sandboxToken = await generateJwtToken(
			user,
			context.env.JWT_SECRET,
			expiresIn,
		);

		const githubToken = await getGithubConnectionToken(user.id, context);

		const response = await request.env.SANDBOX_WORKER.fetch(
			new Request("http://sandbox/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId: user.id,
					taskType: "feature-implementation",
					repo,
					task,
					model: selectedModel,
					userToken: sandboxToken,
					shouldCommit: Boolean(shouldCommit),
					polychatApiUrl:
						request.env.ENV === "production"
							? "https://api.polychat.app"
							: "http://localhost:8787",
					githubToken: githubToken || undefined,
				}),
			}),
		);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Sandbox worker error (${response.status}): ${errorText.slice(0, 500)}`,
			);
		}

		let result: {
			success: boolean;
			summary?: string;
			logs?: string;
			diff?: string;
			error?: string;
			branchName?: string;
		};
		try {
			result = (await response.json()) as {
				success: boolean;
				summary?: string;
				logs?: string;
				diff?: string;
				error?: string;
				branchName?: string;
			};
		} catch {
			throw new Error("Sandbox worker returned invalid JSON");
		}

		if (!result.success) {
			throw new Error(result.error || "Task execution failed");
		}

		return {
			success: true,
			summary: result.summary,
			logs: result.logs,
			diff: result.diff,
			branchName: result.branchName,
		};
	},
};
