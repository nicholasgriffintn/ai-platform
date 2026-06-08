import type { RecipeInvocationResponse } from "@assistant/schemas";

import { defaultModel } from "~/constants/models";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import type { CreateChatCompletionsResponse, IEnv, IUser, Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

function buildRecipeExecutionOptions(params: {
	invocation: RecipeInvocationResponse;
	sms?: {
		from?: string;
		to?: string;
	};
}) {
	return {
		...(params.sms
			? {
					source: "sms",
					sms: {
						enabled: true,
						from: params.sms.from,
						to: params.sms.to,
					},
				}
			: {}),
		recipe: {
			id: params.invocation.recipeId,
			installationId: params.invocation.installationId,
			channel: params.invocation.channel,
			allowedConnectorProviders: params.invocation.allowedConnectorProviders,
			allowedConnectorOperations: params.invocation.allowedConnectorOperations ?? {},
			configuration: params.invocation.configuration,
		},
	};
}

export async function executeRecipeInvocationChat(params: {
	env: IEnv;
	context: ServiceContext;
	user: IUser;
	invocation: RecipeInvocationResponse;
	conversationId?: string;
	priorMessages?: Message[];
	sms?: {
		from?: string;
		to?: string;
	};
}): Promise<{
	conversationId: string;
	response: CreateChatCompletionsResponse;
}> {
	const conversationId = params.conversationId ?? `recipe_${generateId()}`;
	const response = await handleCreateChatCompletions({
		env: params.env,
		context: params.context,
		user: params.user,
		request: {
			completion_id: conversationId,
			messages: [
				...(params.priorMessages ?? []),
				{
					role: "user",
					content: params.invocation.conversationStarter,
				},
			],
			model: defaultModel,
			mode: "agent",
			stream: false,
			store: true,
			enabled_tools: params.invocation.enabledTools,
			approved_tools: params.invocation.enabledTools,
			tool_choice: "auto",
			max_steps: 8,
			temperature: 0.4,
			options: buildRecipeExecutionOptions(params),
		},
	});

	if (response instanceof Response) {
		throw new AssistantError(
			"Recipe execution unexpectedly returned a streaming response",
			ErrorType.INTERNAL_ERROR,
		);
	}

	return { conversationId, response };
}
