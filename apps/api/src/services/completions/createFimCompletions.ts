import {
	getModelConfig,
	getModelConfigByMatchingModel,
} from "~/lib/providers/models";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { ModelRouter } from "~/lib/modelRouter";
import type { IEnv, IUser, ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

interface HandleCreateFimCompletionsRequest {
	env: IEnv;
	model?: string;
	prompt: string;
	suffix?: string;
	max_tokens?: number;
	min_tokens?: number;
	temperature?: number;
	top_p?: number;
	stream?: boolean;
	stop?: string[];
	user?: IUser;
}

export const handleCreateFimCompletions = async ({
	env,
	model,
	prompt,
	suffix,
	max_tokens,
	min_tokens,
	temperature,
	top_p,
	stream,
	stop,
	user,
}: HandleCreateFimCompletionsRequest) => {
	const selectedModel = model ?? ModelRouter.selectFimModel();

	const modelConfig =
		(await getModelConfig(selectedModel, env)) ||
		(await getModelConfigByMatchingModel(selectedModel, env));

	if (!modelConfig) {
		throw new AssistantError(
			`Model ${selectedModel} not found`,
			ErrorType.PARAMS_ERROR,
		);
	}

	if (!modelConfig.supportsFim) {
		throw new AssistantError(
			`Model ${selectedModel} does not support Fill-in-the-Middle completions`,
			ErrorType.PARAMS_ERROR,
		);
	}

	const provider = getChatProvider(modelConfig.provider, { env, user });

	const fimRequest: ChatCompletionParameters = {
		env,
		user,
		model: modelConfig.matchingModel,
		message: prompt,
		prompt,
		suffix,
		fim_mode: true,
		max_tokens,
		min_tokens,
		temperature,
		top_p,
		stream,
		stop,
	};

	const response = await provider.getResponse(fimRequest);

	return response;
};
