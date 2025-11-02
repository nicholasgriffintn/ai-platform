import { getModelConfigByModel } from "~/lib/models";
import { AIProviderFactory } from "~/lib/providers/factory";
import type { ChatCompletionParameters, IEnv, IUser, Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/completions/countTokens" });

interface CountTokensRequest {
	model: string;
	messages: Message[];
	system_prompt?: string;
}

interface CountTokensResponse {
	status: "success" | "error";
	message?: string;
	inputTokens: number;
	model: string;
}

export async function handleCountTokens(
	{ env, user }: { env: IEnv; user?: IUser },
	request: CountTokensRequest,
): Promise<CountTokensResponse> {
	const { model, messages, system_prompt } = request;

	logger.info("Processing token count request", { model });

	const modelConfig = await getModelConfigByModel(model, env);
	if (!modelConfig) {
		return {
			status: "error",
			message: `Model ${model} not found`,
			inputTokens: 0,
			model,
		};
	}

	if (!modelConfig.supportsTokenCounting) {
		return {
			status: "error",
			message: `Token counting is not supported for the model ${model}`,
			inputTokens: 0,
			model,
		};
	}

	const provider = AIProviderFactory.getProvider(modelConfig.provider);
	if (!provider) {
		return {
			status: "error",
			message: `Provider ${modelConfig.provider} not found`,
			inputTokens: 0,
			model,
		};
	}

	if (!provider.countTokens) {
		return {
			status: "error",
			message: `Token counting not supported for provider ${modelConfig.provider}`,
			inputTokens: 0,
			model,
		};
	}

	const matchingModel = modelConfig.matchingModel;

	const params: ChatCompletionParameters = {
		model: matchingModel,
		messages,
		system_prompt,
		env,
		user,
	};

	try {
		const result = await provider.countTokens(params, user?.id);
		return {
			status: "success",
			inputTokens: result.inputTokens,
			model,
		};
	} catch (error) {
		logger.error("Token counting failed", { error, model });
		throw new AssistantError(
			"Failed to count tokens",
			ErrorType.PROVIDER_ERROR,
		);
	}
}
