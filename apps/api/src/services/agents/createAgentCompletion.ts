import { formatToolCalls } from "~/lib/chat/tools";
import { createServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { getModelConfig, getModelConfigByMatchingModel } from "~/lib/providers/models";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import type { ChatCompletionRequestBody } from "@assistant/schemas";
import type { ChatCompletionParameters, IEnv, IUser, Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { buildAgentCompletionTools, buildAgentSystemPrompt } from "./completion-tools";

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
	body: ChatCompletionRequestBody;
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
	const modelDetails =
		(await getModelConfig(modelToUse, env, body.provider)) ||
		(await getModelConfigByMatchingModel(modelToUse || "", env, body.provider));
	if (!modelDetails) {
		throw new AssistantError("Invalid model", ErrorType.PARAMS_ERROR);
	}

	const formattedTools = formatToolCalls(modelDetails.provider, functionSchemas);

	const systemPrompt = buildAgentSystemPrompt(agent);

	const {
		user: _requestUser,
		platform: requestPlatform,
		stop: requestStop,
		tool_choice: requestToolChoice,
		messages: requestMessages,
		...requestBody
	} = body;
	const normalizedMessages: Message[] = requestMessages.map((message) => ({
		...message,
		content: message.content ?? "",
	}));

	const requestParams: Omit<ChatCompletionParameters, "env"> = {
		...requestBody,
		messages: normalizedMessages,
		system_prompt: systemPrompt,
		model: modelToUse,
		provider: agent.model ? modelDetails.provider : body.provider,
		tools: formattedTools,
		stream: false,
		mode: "agent",
		max_steps: agent.max_steps || body.max_steps || 20,
		temperature: Number.parseFloat(agent.temperature) || body.temperature || 0.8,
		current_agent_id: agentId,
		platform: requestPlatform === "obsidian" ? "api" : requestPlatform,
		stop: requestStop ? (Array.isArray(requestStop) ? requestStop : [requestStop]) : undefined,
		tool_choice: normaliseToolChoice(requestToolChoice),
	};

	const response = await handleCreateChatCompletions({
		env: serviceContext.env,
		request: requestParams,
		user,
		anonymousUser,
		context: serviceContext,
	});

	return response;
}

function normaliseToolChoice(
	toolChoice: ChatCompletionRequestBody["tool_choice"],
): Omit<ChatCompletionParameters, "env">["tool_choice"] {
	if (!toolChoice) {
		return undefined;
	}

	if (toolChoice === "auto" || toolChoice === "none" || toolChoice === "required") {
		return toolChoice;
	}

	return {
		type: "function",
		name: toolChoice.function.name,
	};
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
