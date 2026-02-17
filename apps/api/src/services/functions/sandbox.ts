import type { IFunction } from "~/types";
import { executeSandboxWorker } from "~/services/sandbox/worker";
import {
	sandboxPromptStrategySchema,
	type SandboxPromptStrategy,
} from "@assistant/schemas";

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
			promptStrategy: {
				type: "string",
				description:
					"Optional prompting strategy (auto, feature-delivery, bug-fix, refactor, test-hardening)",
			},
			shouldCommit: {
				type: "boolean",
				description:
					"Whether to create a commit inside the sandbox repository after applying changes",
			},
			installationId: {
				type: "number",
				description:
					"Optional GitHub App installation ID to force a specific connection",
			},
		},
		required: ["repo", "task"],
	},
	function: async (
		completion_id,
		args,
		request,
		_app_url,
		_conversationManager,
	) => {
		const { repo, task, model, promptStrategy, shouldCommit } = args as {
			repo: string;
			task: string;
			model?: string;
			promptStrategy?: string;
			shouldCommit?: boolean;
			installationId?: number;
		};
		const parsedPromptStrategyResult = sandboxPromptStrategySchema.safeParse(
			typeof promptStrategy === "string" ? promptStrategy.trim() : undefined,
		);
		const parsedPromptStrategy: SandboxPromptStrategy | undefined =
			parsedPromptStrategyResult.success
				? parsedPromptStrategyResult.data
				: undefined;

		if (!request.context || !request.user) {
			throw new Error("User context is required for sandbox execution");
		}

		const context = request.context;
		const user = request.user;
		const response = await executeSandboxWorker({
			env: request.env,
			context,
			user,
			repo,
			task,
			model,
			promptStrategy: parsedPromptStrategy,
			shouldCommit,
			installationId:
				typeof (args as { installationId?: unknown }).installationId ===
				"number"
					? (args as { installationId: number }).installationId
					: undefined,
		});

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
