import {
	sandboxRunEventSchema,
	sandboxPromptStrategySchema,
	type ExecuteSandboxRunPayload,
	type SandboxRunEvent,
	type SandboxModelSettings,
	type SandboxPromptStrategy,
	type SandboxTaskType,
} from "@assistant/schemas";

import {
	buildSandboxEventToolResponse,
	buildSandboxPlanToolResponse,
	buildSandboxResultToolResponse,
} from "~/lib/chat/sandbox-messages";
import { executeSandboxRunStream } from "~/services/apps/sandbox/execute-stream";
import type { IFunctionResponse, IRequest } from "~/types";
import { jsonSchemaToZod } from "./jsonSchema";
import type { ApiToolDefinition } from "./types";

interface SandboxFunctionArgs {
	repo: string;
	task: string;
	model?: string;
	promptStrategy?: string;
	shouldCommit?: boolean;
	timeoutSeconds?: number;
	installationId?: number;
}

interface SandboxRunStreamResult {
	runId: string;
	finalEvent?: SandboxRunEvent;
	lastEvent?: SandboxRunEvent;
}

const sandboxFunctionParameters = {
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
		timeoutSeconds: {
			type: "number",
			description: "Optional sandbox run timeout in seconds",
		},
		installationId: {
			type: "number",
			description: "Optional GitHub App installation ID to force a specific connection",
		},
	},
	required: ["task"],
} as const;

function parsePromptStrategy(value: string | undefined): SandboxPromptStrategy | undefined {
	const parsed = sandboxPromptStrategySchema.safeParse(
		typeof value === "string" ? value.trim() : undefined,
	);
	return parsed.success ? parsed.data : undefined;
}

function parseInstallationId(args: SandboxFunctionArgs): number | undefined {
	return typeof args.installationId === "number" ? args.installationId : undefined;
}

function getSandboxRequestOptions(request: IRequest) {
	const sandboxOptions = request.request?.options?.sandbox;
	return sandboxOptions && typeof sandboxOptions === "object" ? sandboxOptions : undefined;
}

function pickNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getSandboxModelSettings(request: IRequest): SandboxModelSettings | undefined {
	const body = request.request;
	const sandboxOptions = getSandboxRequestOptions(request);
	const reasoningEffort = body?.reasoning?.effort ?? body?.reasoning_effort;
	const settings: SandboxModelSettings = {
		temperature: pickNumber(body?.temperature),
		top_p: pickNumber(body?.top_p),
		top_k: pickNumber(body?.top_k),
		max_tokens: pickNumber(body?.max_tokens),
		presence_penalty: pickNumber(body?.presence_penalty),
		frequency_penalty: pickNumber(body?.frequency_penalty),
		reasoning_effort: reasoningEffort,
		reasoning: reasoningEffort ? { effort: reasoningEffort } : undefined,
		verbosity: body?.verbosity,
		...sandboxOptions?.modelSettings,
	};

	const hasSetting = Object.values(settings).some((value) => value !== undefined);
	return hasSetting ? settings : undefined;
}

async function executeSandboxFunction(params: {
	request: IRequest;
	args: SandboxFunctionArgs;
	taskType: SandboxTaskType;
	forceShouldCommit?: boolean;
	emitToolResult?: (response: IFunctionResponse) => Promise<void> | void;
}): Promise<IFunctionResponse> {
	const { request, args, taskType, forceShouldCommit, emitToolResult } = params;
	if (!request.context || !request.user) {
		throw new Error("User context is required for sandbox execution");
	}
	const sandboxOptions = getSandboxRequestOptions(request);
	const repo = args.repo || sandboxOptions?.repo;
	if (!repo) {
		throw new Error("Repository is required for sandbox execution");
	}
	const installationId = parseInstallationId(args) ?? sandboxOptions?.installationId;
	if (!installationId) {
		throw new Error("Sandbox GitHub installation is required for sandbox execution");
	}

	const payload: ExecuteSandboxRunPayload = {
		installationId,
		repo,
		task: args.task,
		taskType,
		model: args.model || sandboxOptions?.model || request.request?.model,
		promptStrategy: parsePromptStrategy(args.promptStrategy || sandboxOptions?.promptStrategy),
		shouldCommit:
			typeof forceShouldCommit === "boolean"
				? forceShouldCommit
				: (args.shouldCommit ?? sandboxOptions?.shouldCommit),
		timeoutSeconds: args.timeoutSeconds ?? sandboxOptions?.timeoutSeconds,
		modelSettings: getSandboxModelSettings(request),
	};

	const response = await executeSandboxRunStream({
		env: request.env,
		context: request.context,
		user: request.user,
		payload,
	});
	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Sandbox run error (${response.status}): ${errorText.slice(0, 500)}`);
	}

	const runStream = await consumeSandboxRunStream(response, emitToolResult);
	const finalEvent = runStream.finalEvent;
	if (!finalEvent) {
		throw new Error("Sandbox run stream ended before a terminal event");
	}
	const status =
		finalEvent.type === "run_completed"
			? "completed"
			: finalEvent.type === "run_cancelled"
				? "cancelled"
				: finalEvent.type === "run_failed"
					? "failed"
					: "completed";

	if (status === "failed") {
		return buildSandboxResultToolResponse({
			runId: runStream.runId,
			repo,
			task: args.task,
			taskType,
			model: payload.model,
			status,
			updatedAt: finalEvent?.timestamp ?? runStream.lastEvent?.timestamp,
			completedAt: finalEvent?.completedAt ?? finalEvent?.timestamp,
			error: finalEvent?.error || "Sandbox run failed",
			result: finalEvent?.result,
		});
	}

	return buildSandboxResultToolResponse({
		runId: runStream.runId,
		repo,
		task: args.task,
		taskType,
		model: payload.model,
		status,
		updatedAt: finalEvent?.timestamp ?? runStream.lastEvent?.timestamp,
		completedAt: finalEvent?.completedAt ?? finalEvent?.timestamp,
		error: finalEvent?.error,
		result: finalEvent?.result,
	});
}

async function consumeSandboxRunStream(
	response: Response,
	emitToolResult?: (response: IFunctionResponse) => Promise<void> | void,
): Promise<SandboxRunStreamResult> {
	const runId = response.headers.get("X-Sandbox-Run-Id")?.trim();
	if (!runId) {
		throw new Error("Sandbox run stream did not return a run id");
	}

	if (!response.body) {
		throw new Error("Sandbox run stream response body is empty");
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let finalEvent: SandboxRunEvent | undefined;
	let lastEvent: SandboxRunEvent | undefined;

	const handleEvent = async (event: SandboxRunEvent) => {
		lastEvent = event;
		const planResponse = buildSandboxPlanToolResponse({ runId, event });
		if (planResponse) {
			await emitToolResult?.(planResponse);
		}
		await emitToolResult?.(buildSandboxEventToolResponse(event));
		if (
			event.type === "run_completed" ||
			event.type === "run_failed" ||
			event.type === "run_cancelled"
		) {
			finalEvent = event;
		}
	};

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			if (!value) {
				continue;
			}
			buffer += decoder.decode(value, { stream: true });
			buffer = await parseSandboxSseBuffer(buffer, handleEvent);
		}

		if (buffer.trim()) {
			await parseSandboxSseBuffer(`${buffer}\n\n`, handleEvent);
		}
	} finally {
		reader.releaseLock();
	}

	return { runId, finalEvent, lastEvent };
}

async function parseSandboxSseBuffer(
	buffer: string,
	onEvent: (event: SandboxRunEvent) => Promise<void>,
): Promise<string> {
	const chunks = buffer.split("\n\n");
	const rest = chunks.pop() || "";

	for (const chunk of chunks) {
		const dataLines = chunk
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.startsWith("data: "))
			.map((line) => line.slice(6));
		if (dataLines.length === 0) {
			continue;
		}
		const data = dataLines.join("\n").trim();
		if (!data || data === "[DONE]") {
			continue;
		}
		const parsedJson = JSON.parse(data);
		const parsedEvent = sandboxRunEventSchema.safeParse(parsedJson);
		if (!parsedEvent.success) {
			continue;
		}
		await onEvent(parsedEvent.data);
	}

	return rest;
}

function createSandboxFunction(params: {
	name: string;
	description: string;
	taskType: SandboxTaskType;
	permissions: ApiToolDefinition["permissions"];
	forceShouldCommit?: boolean;
}): ApiToolDefinition {
	return {
		name: params.name,
		description: params.description,
		type: "premium",
		costPerCall: 0.1,
		permissions: params.permissions,
		inputSchema: jsonSchemaToZod(sandboxFunctionParameters),
		execute: async (args, context) => {
			return executeSandboxFunction({
				request: context.request,
				args: args as SandboxFunctionArgs,
				taskType: params.taskType,
				forceShouldCommit: params.forceShouldCommit,
				emitToolResult: context.emitToolResult,
			});
		},
	};
}

export const run_feature_implementation: ApiToolDefinition = createSandboxFunction({
	name: "run_feature_implementation",
	description: "Implement a feature in a GitHub repository using the sandbox worker",
	taskType: "feature-implementation",
	permissions: ["sandbox", "write"],
});

export const run_code_review: ApiToolDefinition = createSandboxFunction({
	name: "run_code_review",
	description: "Run a read-only code review task in a GitHub repository",
	taskType: "code-review",
	permissions: ["sandbox"],
	forceShouldCommit: false,
});

export const run_test_suite: ApiToolDefinition = createSandboxFunction({
	name: "run_test_suite",
	description: "Run a read-only test-suite task in a GitHub repository",
	taskType: "test-suite",
	permissions: ["sandbox"],
	forceShouldCommit: false,
});

export const run_bug_fix: ApiToolDefinition = createSandboxFunction({
	name: "run_bug_fix",
	description: "Diagnose and fix a bug in a GitHub repository using the sandbox worker",
	taskType: "bug-fix",
	permissions: ["sandbox", "write"],
});

export const run_refactoring: ApiToolDefinition = createSandboxFunction({
	name: "run_refactoring",
	description: "Refactor existing code in a GitHub repository while preserving behaviour",
	taskType: "refactoring",
	permissions: ["sandbox", "write"],
});

export const run_documentation: ApiToolDefinition = createSandboxFunction({
	name: "run_documentation",
	description: "Create or update documentation in a GitHub repository using the sandbox worker",
	taskType: "documentation",
	permissions: ["sandbox", "write"],
});

export const run_migration: ApiToolDefinition = createSandboxFunction({
	name: "run_migration",
	description: "Run a migration workflow in a GitHub repository using the sandbox worker",
	taskType: "migration",
	permissions: ["sandbox", "write"],
});
