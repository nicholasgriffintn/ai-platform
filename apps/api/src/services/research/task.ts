import { sanitiseInput } from "~/lib/chat/utils";
import { getAuxiliaryResearchProvider } from "~/lib/models";
import { Research } from "~/lib/research";
import type {
	IEnv,
	IFunctionResponse,
	IUser,
	ParallelResearchResult,
	ParallelTaskRun,
	ExaTaskRun,
	ResearchOptions,
	ResearchProviderName,
	ResearchTaskHandle,
	ResearchResult,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { DynamicAppResponseRepository } from "~/repositories/DynamicAppResponseRepository";

const MAX_INPUT_LENGTH = 15000;

export type ResearchTaskRequest = {
	env: IEnv;
	input: unknown;
	user?: IUser;
	provider?: ResearchProviderName;
	options?: ResearchOptions;
};

export type ResearchTaskStatusRequest = {
	env: IEnv;
	runId: string;
	user?: IUser;
	provider?: ResearchProviderName;
	options?: ResearchOptions;
};

const normaliseInput = (input: unknown): unknown => {
	if (input === undefined || input === null) {
		throw new AssistantError("Missing research input", ErrorType.PARAMS_ERROR);
	}

	if (typeof input === "string") {
		const sanitised = sanitiseInput(input);

		if (!sanitised) {
			throw new AssistantError(
				"Missing research input",
				ErrorType.PARAMS_ERROR,
			);
		}

		if (sanitised.length > MAX_INPUT_LENGTH) {
			throw new AssistantError(
				"Research input is too long",
				ErrorType.PARAMS_ERROR,
			);
		}

		return sanitised;
	}

	if (typeof input === "object") {
		const entries = Object.entries(input as Record<string, unknown>);

		if (entries.length === 0) {
			throw new AssistantError(
				"Research input cannot be empty",
				ErrorType.PARAMS_ERROR,
			);
		}

		return input;
	}

	throw new AssistantError(
		"Unsupported research input type",
		ErrorType.PARAMS_ERROR,
	);
};

const getResearchInstance = async (
	env: IEnv,
	user: IUser | undefined,
	provider?: ResearchProviderName,
) => {
	const providerToUse = await getAuxiliaryResearchProvider(env, user, provider);
	return {
		provider: providerToUse,
		research: Research.getInstance(env, providerToUse, user),
	};
};

export const startResearchTask = async (
	req: ResearchTaskRequest,
): Promise<ResearchTaskHandle> => {
	const { env, user, provider, options } = req;
	const preparedInput = normaliseInput(req.input);

	const { provider: providerToUse, research } = await getResearchInstance(
		env,
		user,
		provider,
	);

	const creation = await research.createTask(preparedInput, options);

	if ("status" in creation) {
		throw new AssistantError(creation.error, ErrorType.EXTERNAL_API_ERROR);
	}

	return {
		provider: providerToUse,
		run: creation.run,
	};
};

export const getResearchTaskStatus = async (
	req: ResearchTaskStatusRequest,
): Promise<ResearchResult> => {
	const { env, runId, user, provider, options } = req;

	const { provider: providerToUse, research } = await getResearchInstance(
		env,
		user,
		provider,
	);
	const responseRepo =
		env.DB && user?.id ? new DynamicAppResponseRepository(env) : null;
	const existingResponse = responseRepo
		? await responseRepo.getResponseByItemId(runId)
		: null;

	const parsePayload = (payload: string | null | undefined) => {
		if (!payload) {
			return undefined;
		}

		try {
			return JSON.parse(payload) as Record<string, any>;
		} catch (_error) {
			return undefined;
		}
	};

	const extractStoredResult = (
		payload: Record<string, any> | undefined,
	): ResearchResult | undefined => {
		const data = payload?.result?.data ?? {};
		const run = data?.run;
		const providerValue =
			data?.provider ?? payload?.result?.provider ?? providerToUse;

		if (!run || !providerValue) {
			return undefined;
		}

		if (providerValue === "parallel") {
			return {
				provider: "parallel",
				run: run as ParallelTaskRun,
				output: data?.output,
				warnings: data?.warnings ?? null,
				poll: data?.poll,
			};
		}

		if (providerValue === "exa") {
			return {
				provider: "exa",
				run: run as ExaTaskRun,
				output: data?.output,
				warnings: data?.warnings ?? null,
				poll: data?.poll,
			};
		}

		return undefined;
	};

	let storedPayload = existingResponse
		? parsePayload(existingResponse.data)
		: undefined;
	let storedResult = extractStoredResult(storedPayload);

	if (
		storedResult &&
		!("status" in storedResult) &&
		storedResult.run?.status === "completed" &&
		storedResult.output !== undefined
	) {
		return storedResult;
	}

	const canPersist =
		Boolean(responseRepo) &&
		Boolean(existingResponse) &&
		existingResponse?.user_id === (user?.id ?? existingResponse?.user_id);

	const persistResult = async (
		merged: ParallelResearchResult | ResearchResult,
		statusLabel: string,
		extra?: Record<string, any>,
	) => {
		if (!canPersist || !existingResponse || !responseRepo) {
			return;
		}

		if ("status" in merged && merged.status === "error") {
			return;
		}

		const result = merged as
			| ParallelResearchResult
			| Extract<ResearchResult, { provider: "parallel" | "exa" }>;

		const basePayload = storedPayload ?? {};
		const baseResult = (basePayload.result ?? {}) as Record<string, any>;
		const baseData = (baseResult.data ?? {}) as Record<string, any>;

		const nextData: Record<string, any> = {
			...baseData,
			provider: result.provider,
			run: result.run,
			warnings: result.warnings ?? null,
			poll: result.poll ?? baseData.poll,
		};

		if (result.output !== undefined) {
			nextData.output = result.output;
		} else if (baseData.output !== undefined) {
			nextData.output = baseData.output;
		}

		const nextResult: Record<string, any> = {
			...baseResult,
			status: statusLabel,
			data: nextData,
		};

		if (extra) {
			for (const [key, value] of Object.entries(extra)) {
				if (value === undefined) {
					delete nextResult[key];
				} else {
					nextResult[key] = value;
				}
			}
		} else if (nextResult.error) {
			delete nextResult.error;
		}

		const nextPayload = {
			...basePayload,
			result: nextResult,
			lastSyncedAt: new Date().toISOString(),
		};

		await responseRepo.updateResponseData(existingResponse.id, nextPayload);
		storedPayload = nextPayload;
		storedResult = merged;
	};

	const result = await research.fetchResult(runId, options);

	if ("status" in result) {
		const now = new Date().toISOString();
		const errorMessage = result.error;

		if (providerToUse === "parallel") {
			const errorRun: ParallelTaskRun = {
				run_id: runId,
				status: "errored",
				is_active: false,
				processor: options?.processor ?? "unknown",
				metadata: null,
				created_at: now,
				modified_at: now,
				warnings: [errorMessage],
				error: errorMessage,
				taskgroup_id: null,
			};

			const errorResult: ParallelResearchResult = {
				provider: "parallel",
				run: errorRun,
				warnings: [errorMessage],
			};

			await persistResult(errorResult, "error", { error: errorMessage });
			return errorResult;
		}

		const errorRun: ExaTaskRun = {
			research_id: runId,
			status: "errored",
			created_at: now,
			error: errorMessage,
			warnings: [errorMessage],
		};

		const errorResult: ResearchResult = {
			provider: "exa",
			run: errorRun,
			warnings: [errorMessage],
		};

		await persistResult(errorResult, "error", { error: errorMessage });
		return errorResult;
	}

	await persistResult(result, result.run.status ?? "running");

	return result;
};

export const handleResearchTask = async (
	req: ResearchTaskRequest,
): Promise<IFunctionResponse> => {
	const { env, user, provider, options } = req;
	const preparedInput = normaliseInput(req.input);

	const { provider: providerToUse, research } = await getResearchInstance(
		env,
		user,
		provider,
	);

	const result = await research.run(preparedInput, options);

	if ("status" in result) {
		throw new AssistantError(result.error, ErrorType.EXTERNAL_API_ERROR);
	}

	return {
		status: "success",
		content: "Research completed",
		data: {
			provider: providerToUse,
			run: result.run,
			output: result.output,
			poll: result.poll,
			warnings: result.warnings,
			raw: result,
		},
	};
};
