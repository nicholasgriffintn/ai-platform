import { formatToolCalls } from "~/lib/chat/tools";
import { createServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { findModelConfig } from "~/lib/providers/models";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import type { ParsedChatCompletionRequestBody } from "@assistant/schemas";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { buildAgentCompletionTools, buildAgentSystemPrompt } from "./completion-tools";
import { prepareAgentCompletionRequest } from "./completion-request";

export async function createAgentCompletion({
	env,
	context,
	body,
	agentId,
	user,
	anonymousUser,
}: {
	env: IEnv;
	context?: ServiceContext;
	body: ParsedChatCompletionRequestBody;
	agentId: string;
	user: IUser | undefined;
	anonymousUser: any;
}) {
	const serviceContext =
		context ??
		createServiceContext({
			env,
			user,
		});

	serviceContext.ensureDatabase();

	const agent = await getValidatedAgent(serviceContext, agentId, user?.id);

	const functionSchemas = await buildAgentCompletionTools(agent, serviceContext.env);

	const modelToUse = agent.model || body.model;
	const modelDetails = await findModelConfig(modelToUse || "", env, body.provider);
	if (!modelDetails) {
		throw new AssistantError("Invalid model", ErrorType.PARAMS_ERROR);
	}

	const formattedTools = formatToolCalls(modelDetails.provider, functionSchemas);

	const systemPrompt = buildAgentSystemPrompt(agent);

	const requestParams = prepareAgentCompletionRequest({
		agent,
		body,
		modelProvider: modelDetails.provider,
		formattedTools,
		systemPrompt,
	});

	const response = await handleCreateChatCompletions({
		env: serviceContext.env,
		request: requestParams,
		user,
		anonymousUser,
		context: serviceContext,
	});

	return response;
}

async function getValidatedAgent(context: ServiceContext, agentId: string, userId?: number) {
	const repo = context.repositories.agents;
	const agent = await repo.getAgentById(agentId);

	if (!agent) {
		throw new AssistantError("Agent not found", ErrorType.NOT_FOUND);
	}

	if (userId && agent.user_id !== userId) {
		throw new AssistantError("Forbidden", ErrorType.AUTHENTICATION_ERROR);
	}

	return agent;
}
