import type { ExecuteSandboxRunPayload as ExecuteSandboxRunStreamPayload } from "@assistant/schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { SANDBOX_RUN_ITEM_TYPE, SANDBOX_RUNS_APP_ID } from "~/constants/app";
import type { IEnv, IUser } from "~/types";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { assertSandboxRunCanStart } from "./run-limits";
import { buildSandboxTimeoutConfig } from "./config";
import { type SandboxRunData } from "./run-data";
import {
	isTerminalSandboxEventType,
	SANDBOX_SSE_HEADERS,
	sleep,
	toSseChunk,
	toSseDoneChunk,
	toSsePingChunk,
} from "./streaming";
import {
	appendRunCoordinatorEvent,
	initRunCoordinatorControl,
	listRunCoordinatorEvents,
	updateRunCoordinatorControl,
} from "./run-coordinator";
import {
	buildSandboxRunDispatchMessage,
	enqueueSandboxRunDispatch,
} from "./dispatch";
import { resolveSandboxModel } from "~/services/sandbox/worker";

const logger = getLogger({ prefix: "services/apps/sandbox/execute-stream" });

const COORDINATOR_POLL_INTERVAL_MS = 900;
const COORDINATOR_HEARTBEAT_INTERVAL_MS = 15000;

interface ExecuteSandboxRunStreamParams {
	env: IEnv;
	context: ServiceContext;
	user: IUser;
	payload: ExecuteSandboxRunStreamPayload;
}

function createCoordinatorEventStream(params: {
	env: IEnv;
	runId: string;
	signal?: AbortSignal;
}): ReadableStream<Uint8Array> {
	const { env, runId, signal } = params;

	return new ReadableStream<Uint8Array>({
		async start(controller) {
			let after = 0;
			let terminalSeen = false;
			let lastHeartbeatAt = Date.now();

			while (!terminalSeen && !signal?.aborted) {
				let envelopes = await listRunCoordinatorEvents({
					env,
					runId,
					after,
				});

				if (envelopes.length === 0) {
					if (
						Date.now() - lastHeartbeatAt >=
						COORDINATOR_HEARTBEAT_INTERVAL_MS
					) {
						lastHeartbeatAt = Date.now();
						controller.enqueue(toSsePingChunk());
					}
					await sleep(COORDINATOR_POLL_INTERVAL_MS);
					continue;
				}

				for (const envelope of envelopes) {
					after = Math.max(after, envelope.index);
					controller.enqueue(toSseChunk(envelope.event));
					if (isTerminalSandboxEventType(envelope.event.type)) {
						terminalSeen = true;
						break;
					}
				}
				envelopes = [];
			}

			controller.enqueue(toSseDoneChunk());
			controller.close();
		},
		cancel() {
			// Run continues in background via queue; stream cancellation only detaches client.
		},
	});
}

export async function executeSandboxRunStream(
	params: ExecuteSandboxRunStreamParams,
): Promise<Response> {
	const { env, context: serviceContext, user, payload } = params;
	await assertSandboxRunCanStart({
		context: serviceContext,
		userId: user.id,
	});

	const model = await resolveSandboxModel({
		context: serviceContext,
		userId: user.id,
		model: payload.model,
	});
	const timeoutConfig = buildSandboxTimeoutConfig({
		env,
		requestedTimeoutSeconds: payload.timeoutSeconds,
	});

	const runId = generateId();
	const now = new Date().toISOString();
	const runData: SandboxRunData = {
		runId,
		installationId: payload.installationId,
		repo: payload.repo,
		task: payload.task,
		model,
		trustLevel: payload.trustLevel ?? "balanced",
		promptStrategy: payload.promptStrategy,
		shouldCommit: Boolean(payload.shouldCommit),
		status: "queued",
		startedAt: now,
		updatedAt: now,
		events: [],
		timeoutSeconds: timeoutConfig.timeoutSeconds,
		timeoutAt: timeoutConfig.timeoutAt,
		workflowPhase: "queued",
	};

	const createdRecord =
		await serviceContext.repositories.appData.createAppDataWithItem(
			user.id,
			SANDBOX_RUNS_APP_ID,
			runId,
			SANDBOX_RUN_ITEM_TYPE,
			runData,
		);

	await initRunCoordinatorControl(env, {
		runId,
		state: "queued",
		updatedAt: runData.updatedAt,
		timeoutSeconds: runData.timeoutSeconds,
		timeoutAt: runData.timeoutAt,
	});
	await appendRunCoordinatorEvent({
		env,
		runId,
		event: {
			type: "run_queued",
			runId,
			repo: payload.repo,
			installationId: payload.installationId,
			timestamp: now,
			timeoutSeconds: timeoutConfig.timeoutSeconds,
			timeoutAt: timeoutConfig.timeoutAt,
			message: "Run queued for sandbox dispatch",
		},
	});

	try {
		const dispatchMessage = await buildSandboxRunDispatchMessage({
			recordId: createdRecord.id,
			runId,
			userId: user.id,
			payload: {
				installationId: payload.installationId,
				repo: payload.repo,
				task: payload.task,
				model,
				promptStrategy: payload.promptStrategy,
				shouldCommit: Boolean(payload.shouldCommit),
				timeoutSeconds: timeoutConfig.timeoutSeconds,
				trustLevel: payload.trustLevel ?? "balanced",
			},
		});
		await enqueueSandboxRunDispatch({
			env,
			message: dispatchMessage,
		});
		await serviceContext.repositories.appData.updateAppData(createdRecord.id, {
			...runData,
			queueDispatchedAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			workflowPhase: "dispatching",
		});
	} catch (error) {
		const failedAt = new Date().toISOString();
		const errorMessage =
			error instanceof Error ? error.message : "Failed to queue sandbox run";
		const failedRun: SandboxRunData = {
			...runData,
			status: "failed",
			updatedAt: failedAt,
			completedAt: failedAt,
			error: errorMessage,
			events: [
				{
					type: "run_failed",
					runId,
					error: errorMessage,
					timestamp: failedAt,
				},
			],
			workflowPhase: "failed",
		};
		await serviceContext.repositories.appData.updateAppData(
			createdRecord.id,
			failedRun,
		);
		await appendRunCoordinatorEvent({
			env,
			runId,
			event: {
				type: "run_failed",
				runId,
				error: errorMessage,
				timestamp: failedAt,
			},
		});
		await updateRunCoordinatorControl({
			env,
			runId,
			state: "cancelled",
			updatedAt: failedAt,
			cancellationReason: errorMessage,
			timeoutSeconds: runData.timeoutSeconds,
			timeoutAt: runData.timeoutAt,
		});
		logger.error("Failed to queue sandbox run", {
			run_id: runId,
			error_message: errorMessage,
		});
		return Response.json({ error: errorMessage }, { status: 500 });
	}

	const stream = createCoordinatorEventStream({
		env,
		runId,
	});
	return new Response(stream, {
		headers: {
			...SANDBOX_SSE_HEADERS,
			"X-Sandbox-Run-Id": runId,
		},
	});
}
