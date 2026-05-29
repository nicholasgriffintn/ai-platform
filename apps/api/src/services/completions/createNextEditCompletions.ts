import { ModelRouter } from "~/lib/modelRouter";
import {
	handleCreateEditCompletions,
	type HandleCreateEditCompletionsRequest,
} from "~/lib/chat/edit-completions";

export const handleCreateNextEditCompletions = async ({
	env,
	model,
	provider: requestedProvider,
	messages,
	stream,
	user,
}: HandleCreateEditCompletionsRequest) =>
	handleCreateEditCompletions(
		{ env, model, provider: requestedProvider, messages, stream, user },
		{
			capability: "supportsNextEdit",
			defaultModel: ModelRouter.selectNextEditModel,
			missingMessagesMessage: "Messages are required for next edit completions",
			operation: "next",
			unsupportedMessage: (selectedModel) =>
				`Model ${selectedModel} does not support next edit completions`,
		},
	);
