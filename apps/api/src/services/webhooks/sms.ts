import type { Context } from "hono";
import type { CreateChatCompletionsResponse } from "~/types";
import { createServiceContext } from "~/lib/context/serviceContext";
import {
	getMessagingProvider,
	isMessagingProviderId,
	parseMessagingCredentialEnvelope,
	type IncomingMessage,
} from "~/lib/providers/capabilities/messaging";
import { executeRecipeInvocationChat } from "~/services/apps/recipes/execution";
import { invokeAssistantRecipe, resolveInstalledAssistantRecipe } from "~/services/apps/recipes";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import { defaultModel } from "~/constants/models";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { extractChatCompletionText } from "~/utils/messages";

const SMS_CHAT_TOOLS = ["trigger_recipe", "get_weather"];

function wantsTaskStatus(message: string): boolean {
	return /\b(status|task|job|queue|queued|running|progress)\b/i.test(message);
}

function extractTaskId(message: string): string | null {
	const explicit = message.match(/\btask[:\s#-]+([a-zA-Z0-9_-]{8,})\b/i);
	return explicit?.[1] ?? null;
}

function formatTaskStatus(task: {
	id: string;
	task_type: string;
	status?: string | null;
	error_message?: string | null;
	created_at: string;
	completed_at?: string | null;
}) {
	const status = task.status ?? "unknown";
	const error = task.error_message ? ` Error: ${task.error_message}` : "";
	return `${task.task_type} ${task.id}: ${status}.${error}`;
}

async function handleTaskStatus(context: ServiceContext, userId: number, message: string) {
	const taskId = extractTaskId(message);
	if (taskId) {
		const task = await context.repositories.tasks.getTaskById(taskId);
		if (!task || task.user_id !== userId) {
			return "I could not find that task for your account.";
		}
		return formatTaskStatus(task);
	}

	const tasks = await context.repositories.tasks.getTasksByUserId(userId, 3);
	if (tasks.length === 0) {
		return "You do not have any recent tasks.";
	}

	return `Recent tasks:\n${tasks.map(formatTaskStatus).join("\n")}`;
}

async function handleRecipeMessage(params: {
	env: IEnv;
	context: ServiceContext;
	user: IUser;
	incoming: IncomingMessage;
}): Promise<string | null> {
	const match = await resolveInstalledAssistantRecipe({
		context: params.context,
		userId: params.user.id,
		query: params.incoming.body,
		requestUrl: undefined,
	});

	if (match.status === "not_found") {
		return null;
	}

	if (match.status === "ambiguous") {
		const names = match.candidates
			.slice(0, 3)
			.map((candidate) => candidate.title)
			.join(", ");
		return `That matches more than one recipe. Reply with the recipe name. Candidates: ${names}.`;
	}

	const invocation = await invokeAssistantRecipe(match.recipe.id, {
		context: params.context,
		userId: params.user.id,
		channel: "sms",
		input: params.incoming.body,
		requireInstalled: true,
	});

	if (!invocation) {
		return "I could not find that recipe.";
	}
	if (invocation.status === "not_installed") {
		return "That recipe is not installed yet.";
	}
	if (invocation.status === "blocked") {
		const missing = invocation.missingConnections.map((connection) => connection.name).join(", ");
		return `That recipe needs setup before I can run it. Missing: ${missing}.`;
	}

	const execution = await executeRecipeInvocationChat({
		env: params.env,
		context: params.context,
		user: params.user,
		invocation,
	});

	return extractChatCompletionText(execution.response, {
		streamingMessage: "SMS assistant responses cannot be streamed",
	});
}

async function handleBoundedChat(params: {
	env: IEnv;
	context: ServiceContext;
	user: IUser;
	incoming: IncomingMessage;
}) {
	const completion = await handleCreateChatCompletions({
		env: params.env,
		context: params.context,
		user: params.user,
		request: {
			model: defaultModel,
			stream: false,
			store: true,
			mode: "agent",
			max_steps: 3,
			enabled_tools: SMS_CHAT_TOOLS,
			approved_tools: SMS_CHAT_TOOLS,
			tool_choice: "auto",
			messages: [{ role: "user", content: params.incoming.body }],
			options: {
				source: "sms",
				sms: {
					enabled: true,
					from: params.incoming.from,
					to: params.incoming.to,
				},
				from: params.incoming.from,
				to: params.incoming.to,
			},
		},
	});

	return extractChatCompletionText(completion, {
		streamingMessage: "SMS assistant responses cannot be streamed",
	});
}

export async function handleSmsAssistantWebhook(c: Context): Promise<Response> {
	const providerId = c.req.param("providerId");
	const providerSettingsId = c.req.param("providerSettingsId");
	if (!providerId || !providerSettingsId || !isMessagingProviderId(providerId)) {
		throw new AssistantError("Invalid SMS webhook route", ErrorType.PARAMS_ERROR);
	}

	const baseContext = createServiceContext({ env: c.env, requestId: c.get("requestId") });
	const providerSettings = await baseContext.repositories.userSettings.getProviderSettingsById({
		providerId,
		providerSettingsId,
	});
	if (!providerSettings || !providerSettings.enabled) {
		throw new AssistantError("SMS provider is not configured", ErrorType.NOT_FOUND);
	}

	const user = await baseContext.repositories.users.getUserById(providerSettings.user_id);
	if (!user) {
		throw new AssistantError("SMS webhook user not found", ErrorType.NOT_FOUND);
	}

	const context = createServiceContext({
		env: c.env,
		user,
		requestId: c.get("requestId"),
	});
	const encryptedValue = await context.repositories.userSettings.getProviderApiKey(
		user.id,
		providerId,
	);
	if (!encryptedValue) {
		throw new AssistantError("SMS provider credentials are not configured", ErrorType.NOT_FOUND);
	}

	const envelope = parseMessagingCredentialEnvelope({ providerId, value: encryptedValue });
	const provider = getMessagingProvider(providerId, {
		env: c.env,
		user,
		config: envelope.credentials,
	});
	const incoming = await provider.parseIncoming(c);
	if (incoming.kind === "control") {
		return c.json(incoming.response);
	}

	const body = wantsTaskStatus(incoming.body)
		? await handleTaskStatus(context, user.id, incoming.body)
		: ((await handleRecipeMessage({ env: c.env, context, user, incoming })) ??
			(await handleBoundedChat({ env: c.env, context, user, incoming })));

	await provider.send({ to: incoming.from, body });

	return c.json({ success: true });
}
