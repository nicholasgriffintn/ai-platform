import type { Context } from "hono";
import type { Message } from "~/types";
import type { CreateChatCompletionsResponse } from "~/types";
import { ConversationManager } from "~/lib/conversationManager";
import { createServiceContext } from "~/lib/context/serviceContext";
import {
	isMessagingProviderId,
	type IncomingMessage,
} from "~/lib/providers/capabilities/messaging";
import {
	getMessagingProviderFromStoredCredential,
	selectConfiguredMessagingDelivery,
} from "~/lib/providers/capabilities/messaging/delivery";
import { executeRecipeInvocationChat } from "~/services/apps/recipes/execution";
import { invokeAssistantRecipe, resolveInstalledAssistantRecipe } from "~/services/apps/recipes";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import { defaultModel } from "~/constants/models";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { IEnv, IUser } from "~/types";
import { sha256Hex } from "~/utils/crypto";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
	buildInboundMessageContent,
	type ChatCompletionNotification,
	extractChatCompletionNotification,
} from "~/utils/messages";

const SMS_CHAT_TOOLS = ["trigger_recipe", "get_weather"];
const SMS_ACTIVE_HISTORY_LIMIT = 8;

function createTextSmsResponse(body: string): ChatCompletionNotification {
	return { body, mediaUrls: [] };
}

function wantsTaskStatus(message: string): boolean {
	const trimmed = message.trim();
	if (!trimmed) {
		return false;
	}
	if (extractTaskId(trimmed)) {
		return true;
	}

	return [
		/^(status|task status|job status|queue status|progress)$/i,
		/\b(task|job|queue)\s+(status|progress)\b/i,
		/\b(status|progress)\s+(of|for|on)\s+(my\s+)?(task|job|queue)s?\b/i,
		/\b(check|show|get)\s+(the\s+)?(status|progress)\b/i,
		/\b(recent|latest|last)\s+(tasks|jobs|queued|running)\b/i,
		/\bwhat('?s| is)\s+(running|queued)\b/i,
	].some((pattern) => pattern.test(trimmed));
}

function extractTaskId(message: string): string | null {
	const uuidPattern = "[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}";
	const opaqueIdPattern = "[a-zA-Z0-9][a-zA-Z0-9_-]{11,}";
	const taskIdPattern = `(?:${uuidPattern}|${opaqueIdPattern})`;
	const labelled = message.match(
		new RegExp(`\\b(?:task|job|queue)[:\\s#-]+(${taskIdPattern})\\b`, "i"),
	);
	if (labelled?.[1]) {
		return labelled[1];
	}

	const direct = message.trim().match(new RegExp(`^${taskIdPattern}$`, "i"));
	return direct?.[0] ?? null;
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

function buildIncomingSmsUserMessage(incoming: IncomingMessage): Message {
	return {
		role: "user",
		content: buildInboundMessageContent({
			body: incoming.body,
			media: incoming.media ?? incoming.mediaUrls?.map((url) => ({ url })),
		}),
	};
}

function normaliseSmsAddress(value: string): string {
	return value.trim().toLowerCase();
}

async function getSmsConversationId(params: {
	userId: number;
	providerSettingsId: string;
	from: string;
	to?: string;
}) {
	const digest = await sha256Hex(
		[
			"sms",
			params.userId.toString(),
			params.providerSettingsId,
			normaliseSmsAddress(params.from),
			normaliseSmsAddress(params.to ?? ""),
		].join(":"),
	);

	return `sms_${digest.slice(0, 40)}`;
}

async function getActiveSmsMessages(params: {
	context: ServiceContext;
	user: IUser;
	conversationId: string;
}) {
	const conversationManager = ConversationManager.getInstance({
		database: params.context.database,
		repositories: params.context.repositories,
		user: params.user,
		env: params.context.env,
		store: true,
		requestCache: params.context.requestCache,
	});

	let messages: Message[];
	try {
		messages = await conversationManager.get(params.conversationId);
	} catch (error) {
		if (error instanceof AssistantError && error.type === ErrorType.NOT_FOUND) {
			return [];
		}

		throw error;
	}

	const priorMessageLimit = SMS_ACTIVE_HISTORY_LIMIT - 1;
	const archiveCount = Math.max(messages.length - priorMessageLimit, 0);
	if (archiveCount > 0) {
		const archiveIds = messages
			.slice(0, archiveCount)
			.flatMap((message) => (message.id ? [message.id] : []));

		await conversationManager.archiveMessages(params.conversationId, archiveIds);
	}

	return messages.slice(-priorMessageLimit);
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
	conversationId: string;
	activeMessages: Message[];
}): Promise<ChatCompletionNotification | null> {
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
		return createTextSmsResponse(
			`That matches more than one recipe. Reply with the recipe name. Candidates: ${names}.`,
		);
	}

	const invocation = await invokeAssistantRecipe(match.recipe.id, {
		context: params.context,
		userId: params.user.id,
		channel: "sms",
		input: params.incoming.body,
		requireInstalled: true,
	});

	if (!invocation) {
		return createTextSmsResponse("I could not find that recipe.");
	}
	if (invocation.status === "not_installed") {
		return createTextSmsResponse("That recipe is not installed yet.");
	}
	if (invocation.status === "blocked") {
		const missing = invocation.missingConnections.map((connection) => connection.name).join(", ");
		return createTextSmsResponse(
			`That recipe needs setup before I can run it. Missing: ${missing}.`,
		);
	}

	const execution = await executeRecipeInvocationChat({
		env: params.env,
		context: params.context,
		user: params.user,
		invocation,
		conversationId: params.conversationId,
		priorMessages: [...params.activeMessages, buildIncomingSmsUserMessage(params.incoming)],
		sms: {
			from: params.incoming.from,
			to: params.incoming.to,
		},
	});

	return extractChatCompletionNotification(execution.response, {
		streamingMessage: "SMS assistant responses cannot be streamed",
	});
}

async function handleBoundedChat(params: {
	env: IEnv;
	context: ServiceContext;
	user: IUser;
	incoming: IncomingMessage;
	conversationId: string;
	activeMessages: Message[];
}) {
	const completion = await handleCreateChatCompletions({
		env: params.env,
		context: params.context,
		user: params.user,
		request: {
			completion_id: params.conversationId,
			model: defaultModel,
			stream: false,
			store: true,
			mode: "agent",
			max_steps: 3,
			enabled_tools: SMS_CHAT_TOOLS,
			approved_tools: SMS_CHAT_TOOLS,
			tool_choice: "auto",
			messages: [...params.activeMessages, buildIncomingSmsUserMessage(params.incoming)],
			options: {
				sms: {
					enabled: true,
					from: params.incoming.from,
					to: params.incoming.to,
				},
			},
		},
	});

	return extractChatCompletionNotification(completion, {
		streamingMessage: "SMS assistant responses cannot be streamed",
	});
}

async function handleAssistantSmsMessage(params: {
	env: IEnv;
	context: ServiceContext;
	user: IUser;
	incoming: IncomingMessage;
	providerSettingsId: string;
}) {
	const conversationId = await getSmsConversationId({
		userId: params.user.id,
		providerSettingsId: params.providerSettingsId,
		from: params.incoming.from,
		to: params.incoming.to,
	});
	const activeMessages = await getActiveSmsMessages({
		context: params.context,
		user: params.user,
		conversationId,
	});

	return (
		(await handleRecipeMessage({
			env: params.env,
			context: params.context,
			user: params.user,
			incoming: params.incoming,
			conversationId,
			activeMessages,
		})) ??
		(await handleBoundedChat({
			env: params.env,
			context: params.context,
			user: params.user,
			incoming: params.incoming,
			conversationId,
			activeMessages,
		}))
	);
}

async function getProviderBoundSmsReplyMediaUrls(params: {
	context: ServiceContext;
	userId: number;
	providerId: string;
	providerSettingsId: string;
	mediaUrls: string[];
}): Promise<string[] | undefined> {
	if (params.mediaUrls.length === 0) {
		return undefined;
	}

	const settings = await params.context.repositories.userSettings.getUserProviderSettings(
		params.userId,
	);
	const currentProviderSettings = settings.find(
		(setting) =>
			setting.id === params.providerSettingsId && setting.provider_id === params.providerId,
	);
	if (!currentProviderSettings) {
		return undefined;
	}

	const delivery = selectConfiguredMessagingDelivery([currentProviderSettings], {
		mediaUrls: params.mediaUrls,
		apiBaseUrl: params.context.env.API_BASE_URL,
	});

	return delivery?.mediaUrls;
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
	const encryptedValue = await context.repositories.userSettings.getProviderApiKeyForSettings({
		userId: user.id,
		providerId,
		providerSettingsId,
	});
	if (!encryptedValue) {
		throw new AssistantError("SMS provider credentials are not configured", ErrorType.NOT_FOUND);
	}

	const provider = getMessagingProviderFromStoredCredential({
		providerId,
		value: encryptedValue,
		env: c.env,
		user,
		context,
	});
	const incoming = await provider.parseIncoming(c);
	if (incoming.kind === "control") {
		return c.json(incoming.response);
	}

	const notification = wantsTaskStatus(incoming.body)
		? createTextSmsResponse(await handleTaskStatus(context, user.id, incoming.body))
		: await handleAssistantSmsMessage({
				env: c.env,
				context,
				user,
				incoming,
				providerSettingsId,
			});
	const replyMediaUrls = await getProviderBoundSmsReplyMediaUrls({
		context,
		userId: user.id,
		providerId,
		providerSettingsId,
		mediaUrls: notification.mediaUrls,
	});

	await provider.send({
		to: incoming.from,
		body: notification.body,
		...(replyMediaUrls?.length ? { mediaUrls: replyMediaUrls } : {}),
	});

	return c.json({ success: true });
}
