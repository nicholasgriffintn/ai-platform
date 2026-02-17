import type { ServiceContext } from "~/lib/context/serviceContext";
import {
	MAX_STORED_STREAM_EVENTS,
	SANDBOX_RUN_ITEM_TYPE,
	SANDBOX_RUNS_APP_ID,
} from "~/constants/app";
import {
	executeSandboxWorker,
	resolveSandboxModel,
} from "~/services/sandbox/worker";
import type { IEnv, IUser } from "~/types";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { parseSseBuffer } from "~/utils/streaming";
import {
	toSandboxRunResponse,
	type SandboxRunData,
	type SandboxRunStatus,
} from "./run-data";

const logger = getLogger({ prefix: "services/apps/sandbox/execute-stream" });

export interface ExecuteSandboxRunStreamPayload {
	installationId: number;
	repo: string;
	task: string;
	model?: string;
	shouldCommit?: boolean;
}

interface ExecuteSandboxRunStreamParams {
	env: IEnv;
	context: ServiceContext;
	user: IUser;
	payload: ExecuteSandboxRunStreamPayload;
}

async function persistFailedRun(params: {
	serviceContext: ServiceContext;
	recordId: string;
	initialRunData: SandboxRunData;
	error: unknown;
}): Promise<void> {
	const { serviceContext, recordId, initialRunData, error } = params;
	const errorMessage =
		error instanceof Error ? error.message : "Sandbox execution failed";
	const completedAt = new Date().toISOString();

	await serviceContext.repositories.appData.updateAppData(recordId, {
		...initialRunData,
		status: "failed",
		error: errorMessage.slice(0, 1000),
		updatedAt: completedAt,
		completedAt,
	});
}

export async function executeSandboxRunStream(
	params: ExecuteSandboxRunStreamParams,
): Promise<Response> {
	const { env, context: serviceContext, user, payload } = params;

	const model = await resolveSandboxModel({
		context: serviceContext,
		userId: user.id,
		model: payload.model,
	});

	const runId = generateId();
	const now = new Date().toISOString();
	const initialRunData: SandboxRunData = {
		runId,
		installationId: payload.installationId,
		repo: payload.repo,
		task: payload.task,
		model,
		shouldCommit: Boolean(payload.shouldCommit),
		status: "queued",
		startedAt: now,
		updatedAt: now,
		events: [],
	};

	const createdRecord =
		await serviceContext.repositories.appData.createAppDataWithItem(
			user.id,
			SANDBOX_RUNS_APP_ID,
			runId,
			SANDBOX_RUN_ITEM_TYPE,
			initialRunData,
		);

	const runningAt = new Date().toISOString();
	await serviceContext.repositories.appData.updateAppData(createdRecord.id, {
		...initialRunData,
		status: "running",
		updatedAt: runningAt,
	});

	let workerResponse: Response;
	try {
		workerResponse = await executeSandboxWorker({
			env,
			context: serviceContext,
			user,
			repo: payload.repo,
			task: payload.task,
			model,
			shouldCommit: payload.shouldCommit,
			installationId: payload.installationId,
			stream: true,
			runId,
		});
	} catch (error) {
		await persistFailedRun({
			serviceContext,
			recordId: createdRecord.id,
			initialRunData,
			error,
		});

		const errorMessage =
			error instanceof Error ? error.message : "Failed to start sandbox run";
		logger.error("Failed to start sandbox worker run", {
			run_id: runId,
			installation_id: payload.installationId,
			error_message: errorMessage,
		});
		return Response.json({ error: errorMessage }, { status: 500 });
	}

	if (!workerResponse.ok) {
		const errorText = await workerResponse.text();
		await serviceContext.repositories.appData.updateAppData(createdRecord.id, {
			...initialRunData,
			status: "failed",
			error: errorText.slice(0, 1000),
			updatedAt: new Date().toISOString(),
			completedAt: new Date().toISOString(),
		});

		return Response.json(
			{
				error: `Sandbox worker error (${workerResponse.status}): ${errorText.slice(0, 500)}`,
			},
			{ status: 500 },
		);
	}

	if (!workerResponse.body) {
		await serviceContext.repositories.appData.updateAppData(createdRecord.id, {
			...initialRunData,
			status: "failed",
			error: "Sandbox worker returned an empty response body",
			updatedAt: new Date().toISOString(),
			completedAt: new Date().toISOString(),
		});
		return Response.json(
			{ error: "Sandbox worker returned an empty response" },
			{ status: 500 },
		);
	}

	const contentType = workerResponse.headers.get("content-type") || "";
	if (!contentType.includes("text/event-stream")) {
		let responseData: Record<string, unknown> | null = null;
		try {
			responseData = (await workerResponse.json()) as Record<string, unknown>;
		} catch {
			await persistFailedRun({
				serviceContext,
				recordId: createdRecord.id,
				initialRunData,
				error: new Error("Sandbox worker returned invalid non-stream response"),
			});
			return Response.json(
				{ error: "Sandbox worker returned invalid non-stream response" },
				{ status: 500 },
			);
		}

		const completedAt = new Date().toISOString();
		const status: SandboxRunStatus = responseData?.success
			? "completed"
			: "failed";
		const responseError =
			typeof responseData?.error === "string" ? responseData.error : undefined;
		await serviceContext.repositories.appData.updateAppData(createdRecord.id, {
			...initialRunData,
			status,
			result: responseData,
			error: responseError,
			updatedAt: completedAt,
			completedAt,
		});

		return Response.json(
			{
				run: toSandboxRunResponse({
					...initialRunData,
					status,
					result: responseData,
					error: responseError,
					updatedAt: completedAt,
					completedAt,
				}),
			},
			{ status: 200 },
		);
	}

	const decoder = new TextDecoder();
	const encoder = new TextEncoder();
	const reader = workerResponse.body.getReader();

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			let status: SandboxRunStatus = "running";
			let buffer = "";
			const events: Array<Record<string, unknown>> = [];
			let result: Record<string, unknown> | undefined;
			let errorMessage: string | undefined;
			let completedAt: string | undefined;

			const pushEvent = (event: Record<string, unknown>) => {
				events.push(event);
				if (events.length > MAX_STORED_STREAM_EVENTS) {
					events.shift();
				}
			};

			const emit = (event: Record<string, unknown>) => {
				pushEvent(event);
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
				);
			};

			const handleParsedEvent = (parsed: Record<string, unknown>) => {
				pushEvent(parsed);

				if (parsed.type === "run_completed") {
					status = "completed";
					completedAt = new Date().toISOString();
					result =
						parsed.result &&
						typeof parsed.result === "object" &&
						!Array.isArray(parsed.result)
							? (parsed.result as Record<string, unknown>)
							: undefined;
				} else if (parsed.type === "run_failed") {
					status = "failed";
					completedAt = new Date().toISOString();
					errorMessage =
						typeof parsed.error === "string"
							? parsed.error
							: "Sandbox run failed";
				} else if (parsed.type === "run_started") {
					status = "running";
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

					controller.enqueue(value);
					buffer += decoder.decode(value, { stream: true });
					buffer = parseSseBuffer(buffer, {
						onEvent: handleParsedEvent,
						onError: (error) => {
							logger.error("Failed to parse sandbox stream event", {
								error_message: error.message,
							});
						},
					});
				}

				if (buffer.trim()) {
					parseSseBuffer(buffer + "\n\n", {
						onEvent: handleParsedEvent,
						onError: () => {
							// Ignore errors from final buffer flush
						},
					});
				}
			} catch (error) {
				status = "failed";
				completedAt = new Date().toISOString();
				errorMessage =
					error instanceof Error
						? error.message
						: "Sandbox stream unexpectedly terminated";

				emit({
					type: "run_failed",
					runId,
					error: errorMessage,
				});
			} finally {
				reader.releaseLock();

				if (status === "running") {
					status = "failed";
					completedAt = new Date().toISOString();
					errorMessage = "Sandbox stream ended without a final status";
					emit({
						type: "run_failed",
						runId,
						error: errorMessage,
					});
				}

				try {
					await serviceContext.repositories.appData.updateAppData(
						createdRecord.id,
						{
							...initialRunData,
							status,
							result,
							error: errorMessage,
							events,
							updatedAt: new Date().toISOString(),
							completedAt,
						},
					);
				} catch (dbError) {
					logger.error("Failed to persist sandbox run final state", {
						error_message:
							dbError instanceof Error ? dbError.message : String(dbError),
						runId,
						status,
					});
				}

				controller.close();
			}
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"X-Sandbox-Run-Id": runId,
		},
	});
}
