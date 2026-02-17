import type { ExecuteSandboxRunPayload as ExecuteSandboxRunStreamPayload } from "@assistant/schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { SANDBOX_RUN_ITEM_TYPE, SANDBOX_RUNS_APP_ID } from "~/constants/app";
import {
	executeSandboxWorker,
	resolveSandboxModel,
} from "~/services/sandbox/worker";
import type { IEnv, IUser } from "~/types";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import {
	toSandboxRunResponse,
	type SandboxRunData,
	type SandboxRunStatus,
} from "./run-data";
import { registerActiveSandboxRun } from "./run-control";
import {
	getPersistedCancelledRun,
	isAbortError,
	persistFailedRun,
	RUN_CANCELLATION_MESSAGE,
} from "./run-state";
import { createSandboxEventProxyStream } from "./stream-proxy";

const logger = getLogger({ prefix: "services/apps/sandbox/execute-stream" });

interface ExecuteSandboxRunStreamParams {
	env: IEnv;
	context: ServiceContext;
	user: IUser;
	payload: ExecuteSandboxRunStreamPayload;
}

async function handleNonStreamWorkerResponse(params: {
	serviceContext: ServiceContext;
	recordId: string;
	runData: SandboxRunData;
	workerResponse: Response;
}): Promise<SandboxRunData> {
	const { serviceContext, recordId, workerResponse } = params;
	let runData = params.runData;
	let responseData: Record<string, unknown>;

	try {
		responseData = (await workerResponse.json()) as Record<string, unknown>;
	} catch {
		await persistFailedRun({
			serviceContext,
			recordId,
			initialRunData: runData,
			error: new Error("Sandbox worker returned invalid non-stream response"),
		});
		throw new Error("Sandbox worker returned invalid non-stream response");
	}

	let completedAt = new Date().toISOString();
	let status: SandboxRunStatus = responseData.success ? "completed" : "failed";
	const responseError =
		typeof responseData.error === "string" ? responseData.error : undefined;
	const cancelledRun = await getPersistedCancelledRun({
		serviceContext,
		recordId,
	});
	if (cancelledRun) {
		status = "cancelled";
		completedAt = cancelledRun.completedAt ?? completedAt;
	}

	runData = {
		...runData,
		status,
		result: responseData,
		error: status === "failed" ? responseError : undefined,
		updatedAt: completedAt,
		completedAt,
		cancelRequestedAt:
			status === "cancelled"
				? (cancelledRun?.cancelRequestedAt ??
					runData.cancelRequestedAt ??
					completedAt)
				: runData.cancelRequestedAt,
		cancellationReason:
			status === "cancelled"
				? (cancelledRun?.cancellationReason ??
					runData.cancellationReason ??
					RUN_CANCELLATION_MESSAGE)
				: runData.cancellationReason,
	};

	await serviceContext.repositories.appData.updateAppData(recordId, runData);
	return runData;
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
	let runData: SandboxRunData = {
		runId,
		installationId: payload.installationId,
		repo: payload.repo,
		task: payload.task,
		model,
		promptStrategy: payload.promptStrategy,
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
			runData,
		);

	runData = {
		...runData,
		status: "running",
		updatedAt: new Date().toISOString(),
	};
	await serviceContext.repositories.appData.updateAppData(
		createdRecord.id,
		runData,
	);

	const workerAbortController = new AbortController();
	const unregisterActiveRun = registerActiveSandboxRun(
		runId,
		workerAbortController,
	);

	let workerResponse: Response;
	try {
		workerResponse = await executeSandboxWorker({
			env,
			context: serviceContext,
			user,
			repo: payload.repo,
			task: payload.task,
			model,
			promptStrategy: payload.promptStrategy,
			shouldCommit: payload.shouldCommit,
			installationId: payload.installationId,
			stream: true,
			runId,
			signal: workerAbortController.signal,
		});
	} catch (error) {
		if (isAbortError(error) || workerAbortController.signal.aborted) {
			const completedAt = new Date().toISOString();
			runData = {
				...runData,
				status: "cancelled",
				updatedAt: completedAt,
				completedAt,
				cancelRequestedAt: runData.cancelRequestedAt ?? completedAt,
				cancellationReason:
					runData.cancellationReason ?? RUN_CANCELLATION_MESSAGE,
			};
			await serviceContext.repositories.appData.updateAppData(
				createdRecord.id,
				runData,
			);

			unregisterActiveRun();
			return Response.json(
				{
					run: toSandboxRunResponse(runData),
				},
				{ status: 200 },
			);
		}

		await persistFailedRun({
			serviceContext,
			recordId: createdRecord.id,
			initialRunData: runData,
			error,
		});

		const errorMessage =
			error instanceof Error ? error.message : "Failed to start sandbox run";
		logger.error("Failed to start sandbox worker run", {
			run_id: runId,
			installation_id: payload.installationId,
			error_message: errorMessage,
		});
		unregisterActiveRun();
		return Response.json({ error: errorMessage }, { status: 500 });
	}

	if (!workerResponse.ok) {
		const cancelledRun = await getPersistedCancelledRun({
			serviceContext,
			recordId: createdRecord.id,
		});
		if (cancelledRun) {
			unregisterActiveRun();
			return Response.json(
				{
					run: toSandboxRunResponse(cancelledRun),
				},
				{ status: 200 },
			);
		}

		const errorText = await workerResponse.text();
		runData = {
			...runData,
			status: "failed",
			error: errorText.slice(0, 1000),
			updatedAt: new Date().toISOString(),
			completedAt: new Date().toISOString(),
		};
		await serviceContext.repositories.appData.updateAppData(
			createdRecord.id,
			runData,
		);

		unregisterActiveRun();
		return Response.json(
			{
				error: `Sandbox worker error (${workerResponse.status}): ${errorText.slice(0, 500)}`,
			},
			{ status: 500 },
		);
	}

	if (!workerResponse.body) {
		runData = {
			...runData,
			status: "failed",
			error: "Sandbox worker returned an empty response body",
			updatedAt: new Date().toISOString(),
			completedAt: new Date().toISOString(),
		};
		await serviceContext.repositories.appData.updateAppData(
			createdRecord.id,
			runData,
		);
		unregisterActiveRun();
		return Response.json(
			{ error: "Sandbox worker returned an empty response" },
			{ status: 500 },
		);
	}

	const contentType = workerResponse.headers.get("content-type") || "";
	if (!contentType.includes("text/event-stream")) {
		try {
			runData = await handleNonStreamWorkerResponse({
				serviceContext,
				recordId: createdRecord.id,
				runData,
				workerResponse,
			});
		} catch (error) {
			unregisterActiveRun();
			return Response.json(
				{
					error:
						error instanceof Error
							? error.message
							: "Sandbox worker returned invalid non-stream response",
				},
				{ status: 500 },
			);
		}

		unregisterActiveRun();
		return Response.json(
			{
				run: toSandboxRunResponse(runData),
			},
			{ status: 200 },
		);
	}

	const stream = createSandboxEventProxyStream({
		reader: workerResponse.body.getReader(),
		runId,
		serviceContext,
		recordId: createdRecord.id,
		initialRunData: runData,
		workerAbortController,
		unregisterActiveRun,
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
