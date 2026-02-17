import {
	sandboxRunEventSchema,
	type SandboxRunEvent,
	type SandboxRunResult,
} from "@assistant/schemas";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { MAX_STORED_STREAM_EVENTS } from "~/constants/app";
import { getLogger } from "~/utils/logger";
import { parseSseBuffer } from "~/utils/streaming";
import {
	appendSandboxRunEvent,
	type SandboxRunData,
	type SandboxRunStatus,
} from "./run-data";
import { getSandboxRunAbortReason } from "./run-control";
import {
	getPersistedRunData,
	isAbortError,
	RUN_CANCELLATION_MESSAGE,
} from "./run-state";

const logger = getLogger({ prefix: "services/apps/sandbox/stream-proxy" });

interface CreateSandboxEventProxyStreamParams {
	reader: ReadableStreamDefaultReader<Uint8Array>;
	runId: string;
	serviceContext: ServiceContext;
	recordId: string;
	initialRunData: SandboxRunData;
	workerAbortController: AbortController;
	unregisterActiveRun: () => void;
}

function isTerminalRunStatus(status: SandboxRunStatus): boolean {
	return (
		status === "completed" || status === "failed" || status === "cancelled"
	);
}

export function createSandboxEventProxyStream(
	params: CreateSandboxEventProxyStreamParams,
): ReadableStream<Uint8Array> {
	const {
		reader,
		runId,
		serviceContext,
		recordId,
		initialRunData,
		workerAbortController,
		unregisterActiveRun,
	} = params;

	const decoder = new TextDecoder();
	const encoder = new TextEncoder();

	return new ReadableStream<Uint8Array>({
		async start(controller) {
			let runData = initialRunData;
			let status: SandboxRunStatus = "running";
			let buffer = "";
			const events: SandboxRunEvent[] = [];
			let result: SandboxRunResult | undefined;
			let errorMessage: string | undefined;
			let completedAt: string | undefined;
			let cancellationReason: string | undefined;
			let promptStrategy = runData.promptStrategy;
			let pausedAt: string | undefined;
			let resumedAt: string | undefined;
			let pauseReason: string | undefined;
			let resumeReason: string | undefined;

			const pushEvent = (event: SandboxRunEvent) => {
				const next = appendSandboxRunEvent(
					events,
					event,
					MAX_STORED_STREAM_EVENTS,
				);
				events.length = 0;
				events.push(...next);
			};

			const emit = (event: SandboxRunEvent) => {
				pushEvent(event);
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
				);
			};

			const handleParsedEvent = (parsed: SandboxRunEvent) => {
				pushEvent(parsed);

				if (parsed.type === "run_completed") {
					status = "completed";
					completedAt = new Date().toISOString();
					result = parsed.result;
					return;
				}

				if (parsed.type === "run_failed") {
					status = "failed";
					completedAt = new Date().toISOString();
					errorMessage =
						typeof parsed.error === "string"
							? parsed.error
							: "Sandbox run failed";
					return;
				}

				if (parsed.type === "run_cancelled") {
					status = "cancelled";
					completedAt = new Date().toISOString();
					cancellationReason =
						typeof parsed.message === "string"
							? parsed.message
							: typeof parsed.error === "string"
								? parsed.error
								: RUN_CANCELLATION_MESSAGE;
					errorMessage = undefined;
					return;
				}

				if (parsed.type === "run_paused") {
					status = "paused";
					pausedAt = new Date().toISOString();
					if (!pauseReason && typeof parsed.message === "string") {
						pauseReason = parsed.message;
					}
					return;
				}

				if (parsed.type === "run_resumed") {
					status = "running";
					resumedAt = new Date().toISOString();
					resumeReason =
						typeof parsed.message === "string" ? parsed.message : resumeReason;
					return;
				}

				if (parsed.type === "run_started") {
					status = "running";
				}

				if (parsed.promptStrategy) {
					promptStrategy = parsed.promptStrategy;
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
						onEvent: (event) => {
							const parsed = sandboxRunEventSchema.safeParse(event);
							if (!parsed.success) {
								return;
							}
							handleParsedEvent(parsed.data);
						},
						onError: (error) => {
							logger.error("Failed to parse sandbox stream event", {
								error_message: error.message,
							});
						},
					});
				}

				if (buffer.trim()) {
					parseSseBuffer(`${buffer}\n\n`, {
						onEvent: (event) => {
							const parsed = sandboxRunEventSchema.safeParse(event);
							if (!parsed.success) {
								return;
							}
							handleParsedEvent(parsed.data);
						},
						onError: () => {
							// Ignore final parse errors from truncated flush buffers.
						},
					});
				}
			} catch (error) {
				if (isAbortError(error) || workerAbortController.signal.aborted) {
					const abortReason = getSandboxRunAbortReason(
						workerAbortController.signal,
					);
					if (abortReason?.type === "timeout") {
						status = "failed";
						completedAt = new Date().toISOString();
						errorMessage = abortReason.message;
						emit({
							type: "run_failed",
							runId,
							error: errorMessage,
							errorType: "timeout",
						});
					} else {
						status = "cancelled";
						completedAt = new Date().toISOString();
						cancellationReason = cancellationReason ?? RUN_CANCELLATION_MESSAGE;
						errorMessage = undefined;
						emit({
							type: "run_cancelled",
							runId,
							message: cancellationReason,
						});
					}
				} else {
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
				}
			} finally {
				reader.releaseLock();

				if (!isTerminalRunStatus(status)) {
					if (workerAbortController.signal.aborted) {
						const abortReason = getSandboxRunAbortReason(
							workerAbortController.signal,
						);
						if (abortReason?.type === "timeout") {
							status = "failed";
							completedAt = new Date().toISOString();
							errorMessage = abortReason.message;
							emit({
								type: "run_failed",
								runId,
								error: errorMessage,
								errorType: "timeout",
							});
						} else {
							status = "cancelled";
							completedAt = new Date().toISOString();
							cancellationReason =
								cancellationReason ?? RUN_CANCELLATION_MESSAGE;
							errorMessage = undefined;
							emit({
								type: "run_cancelled",
								runId,
								message: cancellationReason,
							});
						}
					} else {
						status = "failed";
						completedAt = new Date().toISOString();
						errorMessage = "Sandbox stream ended without a final status";
						emit({
							type: "run_failed",
							runId,
							error: errorMessage,
						});
					}
				}

				let latestPersistedRun: SandboxRunData | null = null;
				try {
					latestPersistedRun = await getPersistedRunData({
						serviceContext,
						recordId,
					});
					if (latestPersistedRun?.status === "cancelled") {
						status = "cancelled";
						completedAt =
							latestPersistedRun.completedAt ??
							completedAt ??
							new Date().toISOString();
						cancellationReason =
							latestPersistedRun.cancellationReason ??
							cancellationReason ??
							RUN_CANCELLATION_MESSAGE;
						errorMessage = undefined;
					}
				} catch (lookupError) {
					logger.error("Failed to verify sandbox cancellation state", {
						error_message:
							lookupError instanceof Error
								? lookupError.message
								: String(lookupError),
						runId,
					});
				}

				try {
					runData = {
						...runData,
						status,
						result,
						error: status === "failed" ? errorMessage : undefined,
						promptStrategy,
						events,
						updatedAt: new Date().toISOString(),
						completedAt,
						pausedAt:
							pausedAt ?? latestPersistedRun?.pausedAt ?? runData.pausedAt,
						resumedAt:
							resumedAt ?? latestPersistedRun?.resumedAt ?? runData.resumedAt,
						pauseReason:
							pauseReason ??
							latestPersistedRun?.pauseReason ??
							runData.pauseReason,
						resumeReason:
							resumeReason ??
							latestPersistedRun?.resumeReason ??
							runData.resumeReason,
						cancelRequestedAt:
							status === "cancelled"
								? (latestPersistedRun?.cancelRequestedAt ??
									runData.cancelRequestedAt ??
									completedAt)
								: (latestPersistedRun?.cancelRequestedAt ??
									runData.cancelRequestedAt),
						cancellationReason:
							status === "cancelled"
								? (cancellationReason ??
									latestPersistedRun?.cancellationReason ??
									RUN_CANCELLATION_MESSAGE)
								: (latestPersistedRun?.cancellationReason ??
									runData.cancellationReason),
					};
					await serviceContext.repositories.appData.updateAppData(
						recordId,
						runData,
					);
				} catch (dbError) {
					logger.error("Failed to persist sandbox run final state", {
						error_message:
							dbError instanceof Error ? dbError.message : String(dbError),
						runId,
						status,
					});
				}

				unregisterActiveRun();
				controller.close();
			}
		},
	});
}
