import { getModelConfig, getModelConfigByMatchingModel } from "~/lib/models";
import { AIProviderFactory } from "~/lib/providers/factory";
import { ModelRouter } from "~/lib/modelRouter";
import type {
	ChatCompletionParameters,
	ChatRole,
	IEnv,
	IUser,
	Message,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

interface HandleCreateNextEditCompletionsRequest {
	env: IEnv;
	model?: string;
	messages: Array<{ role: string; content: any; [key: string]: any }>;
	stream?: boolean;
	user?: IUser;
}

export const handleCreateNextEditCompletions = async ({
	env,
	model,
	messages,
	stream,
	user,
}: HandleCreateNextEditCompletionsRequest) => {
	if (!messages?.length) {
		throw new AssistantError(
			"Messages are required for next edit completions",
			ErrorType.PARAMS_ERROR,
		);
	}

	const selectedModel = model ?? ModelRouter.selectNextEditModel();

	const modelConfig =
		(await getModelConfig(selectedModel, env)) ||
		(await getModelConfigByMatchingModel(selectedModel, env));

	if (!modelConfig) {
		throw new AssistantError(
			`Model ${selectedModel} not found`,
			ErrorType.PARAMS_ERROR,
		);
	}

	if (!modelConfig.supportsNextEdit) {
		throw new AssistantError(
			`Model ${selectedModel} does not support next edit completions`,
			ErrorType.PARAMS_ERROR,
		);
	}

	const provider = AIProviderFactory.getProvider(modelConfig.provider);

	const normalizedMessages: Message[] = messages.map((message) => ({
		role: message.role as ChatRole,
		content: message.content,
		name: message.name,
		tool_calls: message.tool_calls,
		parts: message.parts,
		status: message.status,
		data: message.data,
		model: message.model,
		log_id: message.log_id,
		citations: message.citations,
		app: message.app,
		id: message.id,
		timestamp: message.timestamp,
		platform: message.platform,
	}));

	const editRequest: ChatCompletionParameters = {
		env,
		user,
		model: modelConfig.matchingModel,
		messages: normalizedMessages,
		stream,
		edit_operation: "next",
	};

	return await provider.getResponse(editRequest, user?.id);
};
