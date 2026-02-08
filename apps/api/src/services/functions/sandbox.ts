import type { IFunction } from "~/types";
import { generateJwtToken } from "~/services/auth/jwt";

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
				pattern: "^[\\w-]+/[\\w-]+$",
			},
			task: {
				type: "string",
				description: "Feature to implement or bug to fix",
			},
			model: {
				type: "string",
				description: "Model to use (required if not configured in settings)",
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
		const { repo, task, model } = args as any;

		if (!request.env.SANDBOX_WORKER) {
			throw new Error("Sandbox worker not available");
		}

		const settings =
			await request.context.repositories.userSettings.getUserSettings(
				request.user!.id,
			);
		const selectedModel = model || settings?.sandbox_model;

		if (!selectedModel) {
			throw new Error(
				"No model specified. Provide a model or configure one in settings.",
			);
		}

		const expiresIn = 60 * 60;
		const sandboxToken = await generateJwtToken(
			request.user!,
			request.context.env.JWT_SECRET,
			expiresIn,
		);

		const response = await request.env.SANDBOX_WORKER.fetch(
			new Request("http://sandbox/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId: request.user!.id,
					taskType: "feature-implementation",
					repo,
					task,
					model: selectedModel,
					userToken: sandboxToken,
					polychatApiUrl:
						request.env.ENV === "production"
							? "https://api.polychat.app"
							: "http://localhost:8787",
				}),
			}),
		);

		const result = (await response.json()) as {
			success: boolean;
			summary?: string;
			logs?: string;
			diff?: string;
			error?: string;
		};

		if (!result.success) {
			throw new Error(result.error || "Task execution failed");
		}

		return {
			success: true,
			summary: result.summary,
			logs: result.logs,
			diff: result.diff,
		};
	},
};
