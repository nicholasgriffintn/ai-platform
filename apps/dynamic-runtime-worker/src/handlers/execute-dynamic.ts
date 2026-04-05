import {
	dynamicWorkerExecuteRequestSchema,
	type DynamicWorkerExecuteRequest,
	type SandboxRunEvent,
} from "@assistant/schemas";
import type { Env } from "../types";
import {
	createJsonResponse,
	doneSseChunk,
	isStreamRequest,
	SSE_HEADERS,
	toSseChunk,
} from "../lib/http";
import { executeDynamicWorkerCode } from "../services/execution";

export async function handleDynamicExecute(params: {
	request: Request;
	env: Env;
	ctx: ExecutionContext;
	userToken: string;
	verifiedUserId: number;
}): Promise<Response> {
	const { request, env, ctx, userToken, verifiedUserId } = params;

	let payload: DynamicWorkerExecuteRequest;
	try {
		const parsed = dynamicWorkerExecuteRequestSchema.safeParse(
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
			error: "Dynamic runtime user does not match authorization token",
		});
	}

	if (!isStreamRequest(request)) {
		try {
			const result = await executeDynamicWorkerCode({
				env,
				ctx,
				request: payload,
				userToken,
			});
			return createJsonResponse(200, {
				success: true,
				...result,
			});
		} catch (error) {
			return createJsonResponse(400, {
				error:
					error instanceof Error
						? error.message
						: "Dynamic runtime execution failed",
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
				runtimeBackend: "dynamic-worker",
				timestamp: new Date().toISOString(),
				message: "Dynamic worker run started",
			});

			try {
				const result = await executeDynamicWorkerCode({
					env,
					ctx,
					request: payload,
					userToken,
				});
				emit({
					type: "run_completed",
					runId: payload.runId,
					runtimeBackend: "dynamic-worker",
					completedAt: new Date().toISOString(),
					result: {
						success: result.success !== false,
						...(typeof result.output === "string"
							? { output: result.output }
							: {}),
						logs:
							typeof result.logs === "string"
								? result.logs
								: typeof result.output === "string"
									? result.output
									: undefined,
					},
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
							: "Dynamic runtime execution failed",
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
