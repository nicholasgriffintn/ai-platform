import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { resolveModelConfig } from "~/lib/providers/models";
import type { ChatCompletionParameters, ChatRole, IEnv, IUser, Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export interface HandleCreateEditCompletionsRequest {
	env: IEnv;
	model?: string;
	provider?: string;
	messages: Array<{ role: string; content?: any; [key: string]: any }>;
	stream?: boolean;
	user?: IUser;
}

type EditOperation = "next" | "apply";
type EditCapability = "supportsNextEdit" | "supportsApplyEdit";

interface CreateEditCompletionsOptions {
	capability: EditCapability;
	defaultModel: () => string;
	missingMessagesMessage: string;
	operation: EditOperation;
	unsupportedMessage: (model: string) => string;
}

function normalizeCompletionMessages(
	messages: HandleCreateEditCompletionsRequest["messages"],
): Message[] {
	return messages.map((message) => ({
		role: message.role as ChatRole,
		content: message.content ?? "",
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
}

export async function handleCreateEditCompletions(
	{
		env,
		model,
		provider: requestedProvider,
		messages,
		stream,
		user,
	}: HandleCreateEditCompletionsRequest,
	options: CreateEditCompletionsOptions,
) {
	if (!messages?.length) {
		throw new AssistantError(options.missingMessagesMessage, ErrorType.PARAMS_ERROR);
	}

	const selectedModel = model ?? options.defaultModel();

	const modelConfig = await resolveModelConfig(selectedModel, env, requestedProvider);

	if (!modelConfig[options.capability]) {
		throw new AssistantError(options.unsupportedMessage(selectedModel), ErrorType.PARAMS_ERROR);
	}

	const provider = getChatProvider(modelConfig.provider, { env, user });

	const editRequest: ChatCompletionParameters = {
		env,
		user,
		model: modelConfig.matchingModel,
		provider: modelConfig.provider,
		messages: normalizeCompletionMessages(messages),
		stream,
		edit_operation: options.operation,
	};

	return await provider.getResponse(editRequest, user?.id);
}
