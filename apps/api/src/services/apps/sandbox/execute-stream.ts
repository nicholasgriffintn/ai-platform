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
	SANDBOX_SSE_HEADERS,
	createCoordinatorEventSseStream,
} from "./streaming";
import {
	appendRunCoordinatorEvent,
	initRunCoordinatorControl,
	listRunCoordinatorEvents,
	openRunCoordinatorEventsSocket,
	updateRunCoordinatorControl,
} from "./run-coordinator";
import {
	buildSandboxRunDispatchMessage,
	enqueueSandboxRunDispatchTask,
} from "./dispatch";
import { resolveSandboxModel } from "~/services/sandbox/worker";

const logger = getLogger({ prefix: "services/apps/sandbox/execute-stream" });

interface ExecuteSandboxRunStreamParams {
	env: IEnv;
	context: ServiceContext;
	user: IUser;
	payload: ExecuteSandboxRunStreamPayload;
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
		taskType: payload.taskType,
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
		const dispatchMessage = buildSandboxRunDispatchMessage({
			recordId: createdRecord.id,
			runId,
			userId: user.id,
			payload: {
				installationId: payload.installationId,
				repo: payload.repo,
				task: payload.task,
				taskType: payload.taskType,
				model,
				promptStrategy: payload.promptStrategy,
				shouldCommit: Boolean(payload.shouldCommit),
				timeoutSeconds: timeoutConfig.timeoutSeconds,
				trustLevel: payload.trustLevel ?? "balanced",
			},
		});
		await enqueueSandboxRunDispatchTask({
			context: serviceContext,
			message: dispatchMessage,
		});
		const dispatchedAt = new Date().toISOString();
		await appendRunCoordinatorEvent({
			env,
			runId,
			event: {
				type: "run_dispatched",
				runId,
				timestamp: dispatchedAt,
				message: "Run dispatch enqueued via shared task system",
			},
		});
		await serviceContext.repositories.appData.updateAppData(createdRecord.id, {
			...runData,
			queueDispatchedAt: dispatchedAt,
			updatedAt: dispatchedAt,
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

	const stream = createCoordinatorEventSseStream({
		openSocket: () =>
			openRunCoordinatorEventsSocket({
				env,
				runId,
			}),
		listEvents: (after) =>
			listRunCoordinatorEvents({
				env,
				runId,
				after,
			}),
	});
	return new Response(stream, {
		headers: {
			...SANDBOX_SSE_HEADERS,
			"X-Sandbox-Run-Id": runId,
		},
	});
}
