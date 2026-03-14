import {
	sandboxPromptStrategySchema,
	type SandboxPromptStrategy,
	type SandboxTaskType,
} from "@assistant/schemas";

import { executeSandboxWorker } from "~/services/sandbox/worker";
import type { IFunction, IRequest } from "~/types";

interface SandboxFunctionArgs {
	repo: string;
	task: string;
	model?: string;
	promptStrategy?: string;
	shouldCommit?: boolean;
	installationId?: number;
}

interface SandboxWorkerSuccessResult {
	success: boolean;
	summary?: string;
	logs?: string;
	diff?: string;
	error?: string;
	branchName?: string;
}

const sandboxFunctionParameters: IFunction["parameters"] = {
	type: "object",
	properties: {
		repo: {
			type: "string",
			description: "GitHub repository (format: owner/name)",
			pattern: "^[\\w.-]+/[\\w.-]+$",
		},
		task: {
			type: "string",
			description: "Task to run against the repository",
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
};

function parsePromptStrategy(
	value: string | undefined,
): SandboxPromptStrategy | undefined {
	const parsed = sandboxPromptStrategySchema.safeParse(
		typeof value === "string" ? value.trim() : undefined,
	);
	return parsed.success ? parsed.data : undefined;
}

function parseInstallationId(args: SandboxFunctionArgs): number | undefined {
	return typeof args.installationId === "number"
		? args.installationId
		: undefined;
}

async function executeSandboxFunction(params: {
	request: IRequest;
	args: SandboxFunctionArgs;
	taskType: SandboxTaskType;
	forceShouldCommit?: boolean;
}): Promise<SandboxWorkerSuccessResult> {
	const { request, args, taskType, forceShouldCommit } = params;
	if (!request.context || !request.user) {
		throw new Error("User context is required for sandbox execution");
	}

	const response = await executeSandboxWorker({
		env: request.env,
		context: request.context,
		user: request.user,
		repo: args.repo,
		task: args.task,
		model: args.model,
		taskType,
		promptStrategy: parsePromptStrategy(args.promptStrategy),
		shouldCommit:
			typeof forceShouldCommit === "boolean"
				? forceShouldCommit
				: args.shouldCommit,
		installationId: parseInstallationId(args),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`Sandbox worker error (${response.status}): ${errorText.slice(0, 500)}`,
		);
	}

	let result: SandboxWorkerSuccessResult;
	try {
		result = (await response.json()) as SandboxWorkerSuccessResult;
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
}

function createSandboxFunction(params: {
	name: string;
	description: string;
	taskType: SandboxTaskType;
	forceShouldCommit?: boolean;
}): IFunction {
	return {
		name: params.name,
		description: params.description,
		type: "premium",
		costPerCall: 0.1,
		parameters: sandboxFunctionParameters,
		function: async (_completionId, args, request) => {
			return executeSandboxFunction({
				request,
				args: args as SandboxFunctionArgs,
				taskType: params.taskType,
				forceShouldCommit: params.forceShouldCommit,
			});
		},
	};
}

export const run_feature_implementation: IFunction = createSandboxFunction({
	name: "run_feature_implementation",
	description:
		"Implement a feature in a GitHub repository using the sandbox worker",
	taskType: "feature-implementation",
});

export const run_code_review: IFunction = createSandboxFunction({
	name: "run_code_review",
	description: "Run a read-only code review task in a GitHub repository",
	taskType: "code-review",
	forceShouldCommit: false,
});

export const run_test_suite: IFunction = createSandboxFunction({
	name: "run_test_suite",
	description: "Run a read-only test-suite task in a GitHub repository",
	taskType: "test-suite",
	forceShouldCommit: false,
});

export const run_bug_fix: IFunction = createSandboxFunction({
	name: "run_bug_fix",
	description:
		"Diagnose and fix a bug in a GitHub repository using the sandbox worker",
	taskType: "bug-fix",
});
