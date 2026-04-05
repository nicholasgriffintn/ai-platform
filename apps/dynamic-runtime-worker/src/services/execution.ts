import type {
	DynamicWorkerExecuteRequest,
	SandboxWorkerExecuteRequest,
} from "@assistant/schemas";
import type { Env } from "../types";
import { buildDefaultDynamicModule } from "../lib/default-module";

type ExecutionContextWithExports = ExecutionContext & {
	exports: {
		ToolGateway: (options: {
			props: {
				capabilities: string[];
				userToken: string;
				runId: string;
			};
		}) => unknown;
		DynamicWorkerTail: (options: {
			props: {
				runId: string;
			};
		}) => unknown;
	};
};

export async function executeDynamicWorkerCode(params: {
	env: Env;
	ctx: ExecutionContext;
	request: DynamicWorkerExecuteRequest;
	userToken: string;
}): Promise<Record<string, unknown>> {
	const { env, request, userToken, ctx } = params;

	const moduleSource =
		typeof request.code === "string" && request.code.trim().length > 0
			? request.code
			: buildDefaultDynamicModule(request.task);

	const capabilities = request.capabilities.length
		? request.capabilities
		: ["echo", "clock"];
	const ctxExports = (ctx as ExecutionContextWithExports).exports;

	const worker = env.LOADER.load({
		compatibilityDate: "2026-03-29",
		mainModule: "index.js",
		modules: {
			"index.js": moduleSource,
		},
		env: {
			TOOLS: ctxExports.ToolGateway({
				props: {
					capabilities,
					userToken,
					runId: request.runId,
				},
			}),
		},
		globalOutbound: null,
		tails: [
			ctxExports.DynamicWorkerTail({
				props: {
					runId: request.runId,
				},
			}),
		],
	});

	const response = await worker.getEntrypoint().fetch(
		new Request("https://dynamic-worker/run", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				task: request.task,
				capabilities,
			}),
		}),
	);

	const contentType = response.headers.get("content-type") ?? "";
	if (contentType.includes("application/json")) {
		return (await response.json()) as Record<string, unknown>;
	}

	return {
		success: response.ok,
		output: await response.text(),
	};
}

export function buildSandboxFallbackResult(params: {
	request: SandboxWorkerExecuteRequest;
	dynamicResult: Record<string, unknown>;
}): Record<string, unknown> {
	const { request, dynamicResult } = params;
	const output =
		typeof dynamicResult.output === "string"
			? dynamicResult.output
			: typeof dynamicResult.message === "string"
				? dynamicResult.message
				: "Dynamic worker task completed";

	return {
		success: dynamicResult.success !== false,
		summary: `Dynamic backend processed ${request.taskType ?? "code-review"} task for ${request.repo}.`,
		logs: output,
		diff: undefined,
	};
}
