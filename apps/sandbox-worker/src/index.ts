import { executeFeatureImplementation } from "./tasks/feature-implementation";
import { verifySandboxJwt } from "./lib/auth";
import { SandboxCancellationError } from "./lib/cancellation";
import { sandboxWorkerExecuteRequestSchema } from "@assistant/schemas";
import type { TaskEvent, TaskParams, TaskSecrets, Env } from "./types";

const SSE_HEADERS = {
	"Content-Type": "text/event-stream",
	"Cache-Control": "no-cache, no-transform",
	Connection: "keep-alive",
} as const;

function toSseChunk(value: unknown): Uint8Array {
	return new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`);
}

function isSafePolychatApiUrl(polychatApiUrl: string): boolean {
	try {
		const parsed = new URL(polychatApiUrl);
		if (!["http:", "https:"].includes(parsed.protocol)) {
			return false;
		}
		if (parsed.username || parsed.password) {
			return false;
		}
	} catch {
		return false;
	}

	return true;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname !== "/execute") {
			return Response.json({ error: "Not found" }, { status: 404 });
		}

		if (request.method !== "POST") {
			return Response.json({ error: "Method not allowed" }, { status: 405 });
		}

		if (!env.JWT_SECRET?.trim()) {
			return Response.json(
				{ error: "Sandbox authentication secret is not configured" },
				{ status: 503 },
			);
		}

		let params: TaskParams;
		try {
			const rawBody = (await request.json()) as unknown;
			const parsedPayload =
				sandboxWorkerExecuteRequestSchema.safeParse(rawBody);
			if (!parsedPayload.success) {
				return Response.json(
					{ error: "Invalid task payload" },
					{ status: 400 },
				);
			}
			params = parsedPayload.data;
		} catch {
			return Response.json({ error: "Invalid JSON body" }, { status: 400 });
		}

		const authHeader = request.headers.get("Authorization");
		const userToken = authHeader?.startsWith("Bearer ")
			? authHeader.slice("Bearer ".length).trim()
			: "";
		if (!userToken) {
			return Response.json(
				{ error: "Missing authorization token" },
				{ status: 401 },
			);
		}

		const githubToken = request.headers.get("X-GitHub-Token")?.trim();
		if (!githubToken) {
			return Response.json(
				{ error: "Missing GitHub installation token" },
				{ status: 400 },
			);
		}

		let tokenUserId: number;
		try {
			const verified = await verifySandboxJwt(userToken, env.JWT_SECRET.trim());
			tokenUserId = verified.userId;
		} catch {
			return Response.json(
				{ error: "Invalid sandbox authorization token" },
				{ status: 401 },
			);
		}

		if (
			typeof params.userId === "number" &&
			Number.isFinite(params.userId) &&
			params.userId !== tokenUserId
		) {
			return Response.json(
				{ error: "Sandbox user does not match authorization token" },
				{ status: 403 },
			);
		}
		params.userId = tokenUserId;

		params.taskType = params.taskType || "feature-implementation";

		const secrets: TaskSecrets = {
			userToken,
			githubToken,
		};

		if (!isSafePolychatApiUrl(params.polychatApiUrl)) {
			return Response.json({ error: "Invalid task payload" }, { status: 400 });
		}

		const executeTask = async (
			emitEvent?: (event: TaskEvent) => Promise<void> | void,
		) => {
			// TODO: Add code interpreter: https://developers.cloudflare.com/sandbox/guides/code-execution/
			switch (params.taskType) {
				case "feature-implementation":
					return executeFeatureImplementation(
						params,
						secrets,
						env,
						emitEvent,
						request.signal,
					);
				default:
					throw new Error("Unknown task type");
			}
		};

		const wantsStream = request.headers
			.get("accept")
			?.includes("text/event-stream");
		if (!wantsStream) {
			try {
				return Response.json(await executeTask());
			} catch (error) {
				return Response.json(
					{
						error:
							error instanceof Error
								? error.message
								: "Unknown task execution error",
					},
					{ status: 400 },
				);
			}
		}

		const stream = new ReadableStream<Uint8Array>({
			async start(controller) {
				const emitEvent = (event: TaskEvent) => {
					controller.enqueue(
						toSseChunk({
							...event,
							runId: event.runId ?? params.runId,
						}),
					);
				};

				emitEvent({
					type: "run_started",
					runId: params.runId,
					repo: params.repo,
					installationId: params.installationId,
					startedAt: new Date().toISOString(),
				});

				try {
					const result = await executeTask(emitEvent);
					if (result.success) {
						emitEvent({
							type: "run_completed",
							runId: params.runId,
							completedAt: new Date().toISOString(),
							result,
						});
					} else if (result.errorType === "cancelled") {
						emitEvent({
							type: "run_cancelled",
							runId: params.runId,
							completedAt: new Date().toISOString(),
							message: result.error || "Sandbox run cancelled",
							result,
						});
					} else {
						emitEvent({
							type: "run_failed",
							runId: params.runId,
							completedAt: new Date().toISOString(),
							error: result.error || "Sandbox task failed",
							result,
						});
					}
				} catch (error) {
					if (
						error instanceof SandboxCancellationError ||
						request.signal.aborted
					) {
						emitEvent({
							type: "run_cancelled",
							runId: params.runId,
							completedAt: new Date().toISOString(),
							message:
								error instanceof Error
									? error.message
									: "Sandbox run cancelled",
						});
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
						controller.close();
						return;
					}

					emitEvent({
						type: "run_failed",
						runId: params.runId,
						completedAt: new Date().toISOString(),
						error:
							error instanceof Error
								? error.message
								: "Unknown task execution error",
					});
				} finally {
					controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
					controller.close();
				}
			},
		});

		return new Response(stream, {
			headers: SSE_HEADERS,
		});
	},
};

export { Sandbox } from "@cloudflare/sandbox";
