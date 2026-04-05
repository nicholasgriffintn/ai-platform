import {
	sandboxWorkerExecuteRequestSchema,
	type DynamicWorkerExecuteRequest,
	type SandboxRunEvent,
	type SandboxWorkerExecuteRequest,
} from "@assistant/schemas";
import type { Env } from "../types";
import {
	createJsonResponse,
	doneSseChunk,
	isStreamRequest,
	SSE_HEADERS,
	toSseChunk,
} from "../lib/http";
import {
	buildSandboxFallbackResult,
	executeDynamicWorkerCode,
} from "../services/execution";

export async function handleSandboxExecute(params: {
	request: Request;
	env: Env;
	ctx: ExecutionContext;
	userToken: string;
	verifiedUserId: number;
}): Promise<Response> {
	const { request, env, ctx, userToken, verifiedUserId } = params;

	let payload: SandboxWorkerExecuteRequest;
	try {
		const parsed = sandboxWorkerExecuteRequestSchema.safeParse(
			await request.json(),
		);
		if (!parsed.success) {
			return createJsonResponse(400, { error: "Invalid task payload" });
		}
		payload = parsed.data;
	} catch {
		return createJsonResponse(400, { error: "Invalid JSON body" });
	}

	if (payload.userId !== verifiedUserId) {
		return createJsonResponse(403, {
			error: "Sandbox user does not match authorization token",
		});
	}
	if (!request.headers.get("X-GitHub-Token")?.trim()) {
		return createJsonResponse(400, {
			error: "Missing GitHub installation token",
		});
	}

	if ((payload.taskType ?? "feature-implementation") !== "code-review") {
		return createJsonResponse(400, {
			error:
				"Dynamic runtime sandbox fallback currently supports code-review only",
		});
	}

	const dynamicRequest: DynamicWorkerExecuteRequest = {
		userId: payload.userId,
		runId: payload.runId ?? `dynamic-${Date.now()}`,
		task: `Repository: ${payload.repo}\nTask: ${payload.task}`,
		code: undefined,
		model: payload.model,
		trustLevel: payload.trustLevel,
		capabilities: ["echo", "clock"],
		timeoutSeconds: payload.timeoutSeconds,
		polychatApiUrl: payload.polychatApiUrl,
	};

	if (!isStreamRequest(request)) {
		try {
			const result = await executeDynamicWorkerCode({
				env,
				ctx,
				request: dynamicRequest,
				userToken,
			});
			return createJsonResponse(
				200,
				buildSandboxFallbackResult({
					request: payload,
					dynamicResult: result,
				}),
			);
		} catch (error) {
			return createJsonResponse(400, {
				error:
					error instanceof Error
						? error.message
						: "Dynamic sandbox fallback failed",
			});
		}
	}

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const emit = (event: SandboxRunEvent) => {
				controller.enqueue(toSseChunk(event));
			};

			emit({
				type: "run_started",
				runId: payload.runId,
				repo: payload.repo,
				installationId: payload.installationId,
				runtimeBackend: "dynamic-worker",
				startedAt: new Date().toISOString(),
				message: "Dynamic worker sandbox fallback started",
			});

			try {
				const result = await executeDynamicWorkerCode({
					env,
					ctx,
					request: dynamicRequest,
					userToken,
				});
				const fallbackResult = buildSandboxFallbackResult({
					request: payload,
					dynamicResult: result,
				});
				emit({
					type: "run_completed",
					runId: payload.runId,
					runtimeBackend: "dynamic-worker",
					completedAt: new Date().toISOString(),
					result: fallbackResult,
				});
			} catch (error) {
				emit({
					type: "run_failed",
					runId: payload.runId,
					runtimeBackend: "dynamic-worker",
					completedAt: new Date().toISOString(),
					error:
						error instanceof Error
							? error.message
							: "Dynamic sandbox fallback failed",
				});
			}

			controller.enqueue(doneSseChunk());
			controller.close();
		},
	});

	return new Response(stream, {
		headers: SSE_HEADERS,
	});
}
