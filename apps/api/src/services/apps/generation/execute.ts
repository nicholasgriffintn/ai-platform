import type { TaskType } from "@assistant/schemas";

import { getModelConfigByModel } from "~/lib/providers/models";
import { validateReplicatePayload } from "~/lib/providers/models/replicateValidation";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { TaskRepository } from "~/repositories/TaskRepository";
import { TaskService } from "~/services/tasks/TaskService";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { isRecord } from "~/utils/objects";

export interface ExecuteModelGenerationParams {
	modelId: string;
	input: Record<string, unknown>;
	providerWaitSeconds?: number;
}

export interface ExecuteModelGenerationStorage {
	appId: string;
	itemType: string;
	extraData?: Record<string, unknown>;
	pollingTaskType?: TaskType;
}

export interface ExecuteModelGenerationRequest {
	context?: ServiceContext;
	env?: IEnv;
	params: ExecuteModelGenerationParams;
	storage: ExecuteModelGenerationStorage;
	user: IUser;
	app_url?: string;
}

export interface ExecuteModelGenerationResponse {
	status: "success";
	content: string;
	data: Record<string, unknown>;
}

type StoredGenerationStatus = "processing" | "completed" | "failed";

function extractAsyncInvocation(
	providerResponse: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	const data = providerResponse?.data;
	if (!isRecord(data)) {
		return undefined;
	}

	const asyncInvocation = data.asyncInvocation;
	if (!isRecord(asyncInvocation)) {
		return undefined;
	}

	return asyncInvocation;
}

function resolveStoredStatus(
	providerResponse: Record<string, unknown> | undefined,
): StoredGenerationStatus {
	const rawStatus =
		typeof providerResponse?.status === "string" ? providerResponse.status.toLowerCase() : "";

	if (["failed", "error", "canceled", "cancelled"].includes(rawStatus)) {
		return "failed";
	}

	if (["in_progress", "processing", "queued", "starting"].includes(rawStatus)) {
		return "processing";
	}

	if (extractAsyncInvocation(providerResponse)) {
		return "processing";
	}

	return "completed";
}

function resolveGenerationError(
	providerResponse: Record<string, unknown> | undefined,
): string | undefined {
	const error = providerResponse?.error;
	return typeof error === "string" ? error : undefined;
}

export const executeModelGeneration = async (
	req: ExecuteModelGenerationRequest,
): Promise<ExecuteModelGenerationResponse> => {
	const { params, context, env, user, app_url, storage } = req;

	if (!params.modelId || !params.input) {
		throw new AssistantError("Missing model ID or input parameters", ErrorType.PARAMS_ERROR);
	}

	if (!user?.id) {
		throw new AssistantError("User data required", ErrorType.PARAMS_ERROR);
	}

	const serviceContext = resolveServiceContext({ context, env, user });
	const modelConfig = await getModelConfigByModel(params.modelId, serviceContext.env);

	if (!modelConfig) {
		throw new AssistantError(
			`Model configuration not found for ${params.modelId}`,
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	validateReplicatePayload({
		payload: params.input,
		schema: modelConfig.inputSchema,
		modelName: modelConfig.name || params.modelId,
	});

	const provider = getChatProvider(modelConfig.provider || "replicate", {
		env: serviceContext.env,
		user,
	});

	const invocationId = generateId();
	const providerResponseResult = await provider.getResponse({
		completion_id: invocationId,
		app_url,
		model: modelConfig.matchingModel,
		messages: [
			{
				role: "user",
				content: typeof params.input.prompt === "string" ? params.input.prompt : "",
			},
		],
		body: {
			input: params.input,
		},
		replicate_wait_seconds: params.providerWaitSeconds,
		env: serviceContext.env,
		user,
		store: false,
	});
	const providerResponse = isRecord(providerResponseResult) ? providerResponseResult : {};

	const status = resolveStoredStatus(providerResponse);
	const asyncInvocation = extractAsyncInvocation(providerResponse);
	if (status === "processing" && !asyncInvocation) {
		throw new AssistantError(
			"Provider response is async but missing async invocation metadata",
			ErrorType.PROVIDER_ERROR,
		);
	}

	const generationOutput = providerResponse?.response ?? providerResponse?.output ?? undefined;
	const generationError = resolveGenerationError(providerResponse);

	const appDataPayload: Record<string, unknown> = {
		...storage.extraData,
		modelId: params.modelId,
		modelName: modelConfig.name,
		provider: modelConfig.provider,
		input: params.input,
		predictionData: providerResponse,
		output: generationOutput,
		error: generationError,
		status,
		createdAt: new Date().toISOString(),
	};

	const stored = await serviceContext.repositories.appData.createAppDataWithItem(
		user.id,
		storage.appId,
		invocationId,
		storage.itemType,
		appDataPayload,
	);

	if (!stored?.id) {
		throw new AssistantError("Failed to store generation data", ErrorType.STORAGE_ERROR);
	}

	if (status === "processing" && storage.pollingTaskType && serviceContext.env.DB) {
		const taskRepository = new TaskRepository(serviceContext.env);
		const taskService = new TaskService(serviceContext.env, taskRepository);

		await taskService.enqueueTask({
			task_type: storage.pollingTaskType,
			user_id: user.id,
			task_data: {
				predictionId: stored.id,
				userId: user.id,
				modelId: params.modelId,
				startedAt: new Date().toISOString(),
				pollAttempt: 0,
			},
			priority: 6,
		});
	}

	const contentByStatus: Record<StoredGenerationStatus, string> = {
		processing: `Generation started: ${invocationId}`,
		completed: `Generation completed: ${invocationId}`,
		failed: `Generation failed: ${invocationId}`,
	};

	return {
		status: "success",
		content: contentByStatus[status],
		data: {
			id: stored.id,
			...stored,
		},
	};
};
