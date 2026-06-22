import type { RecipeConfiguration } from "@assistant/schemas";
import { createServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import {
	getMessagingProviderFromStoredCredential,
	selectConfiguredMessagingDelivery,
} from "~/lib/providers/capabilities/messaging/delivery";
import {
	executeRecipeInvocationChat,
	recordRecipeInvocationFailure,
} from "~/services/apps/recipes/execution";
import { invokeAssistantRecipe } from "~/services/apps/recipes";
import type { IEnv, IUser } from "~/types";
import { extractChatCompletionNotification } from "~/utils/messages";
import { getLogger } from "~/utils/logger";
import type { TaskHandler, TaskResult } from "../TaskHandler";
import type { TaskMessage } from "../TaskService";

const logger = getLogger({ prefix: "services/tasks/handlers/RecipeExecutionHandler" });

interface RecipeExecutionTaskData {
	recipeId: string;
	input?: string;
	channel?: "web" | "ios" | "sms" | "scheduled" | "tool";
	configuration?: RecipeConfiguration;
	notificationChannel?: "sms";
	notificationTarget?: string;
}

function getRecipeExecutionConversationId(taskId: string): string {
	return `recipe_${taskId}`;
}

async function sendRecipeSmsNotification(params: {
	env: IEnv;
	context: ServiceContext;
	user: IUser;
	userId: number;
	to: string;
	body: string;
	mediaUrls?: string[];
}): Promise<void> {
	const messagingProvider = selectConfiguredMessagingDelivery(
		await params.context.repositories.userSettings.getUserProviderSettings(params.userId),
		{ mediaUrls: params.mediaUrls, apiBaseUrl: params.env.API_BASE_URL },
	);
	if (!messagingProvider) {
		throw new Error("No configured SMS provider can send this scheduled recipe notification");
	}

	const encryptedValue =
		await params.context.repositories.userSettings.getProviderApiKeyForSettings({
			userId: params.userId,
			providerId: messagingProvider.providerId,
			providerSettingsId: messagingProvider.id,
		});
	if (!encryptedValue) {
		throw new Error("SMS provider credentials are not configured");
	}

	const provider = getMessagingProviderFromStoredCredential({
		providerId: messagingProvider.providerId,
		value: encryptedValue,
		env: params.env,
		user: params.user,
		context: params.context,
	});
	await provider.send({
		to: params.to,
		body: params.body,
		...(messagingProvider.mediaUrls?.length ? { mediaUrls: messagingProvider.mediaUrls } : {}),
	});
}

export class RecipeExecutionHandler implements TaskHandler {
	public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
		const data = message.task_data as RecipeExecutionTaskData;
		if (!message.user_id || !data.recipeId) {
			return {
				status: "error",
				message: "user_id and recipeId are required for recipe execution",
			};
		}

		const baseContext = createServiceContext({ env });
		const user = await baseContext.repositories.users.getUserById(message.user_id);
		if (!user) {
			return {
				status: "error",
				message: `User ${message.user_id} not found for recipe execution`,
			};
		}

		const context = createServiceContext({ env, user: user as IUser });
		const invocation = await invokeAssistantRecipe(data.recipeId, {
			context,
			userId: message.user_id,
			channel: data.channel ?? "scheduled",
			input: data.input,
			configuration: data.configuration,
			requireInstalled: true,
		});

		if (!invocation) {
			return {
				status: "error",
				message: `Recipe ${data.recipeId} not found`,
			};
		}

		if (invocation.status === "blocked") {
			return {
				status: "skipped",
				message: "Recipe execution blocked by missing connectors",
				data: invocation,
			};
		}

		if (invocation.status === "not_installed") {
			return {
				status: "skipped",
				message: "Recipe execution skipped because the recipe is not installed",
				data: invocation,
			};
		}

		const conversationId = getRecipeExecutionConversationId(message.taskId);
		let execution: Awaited<ReturnType<typeof executeRecipeInvocationChat>>;
		try {
			execution = await executeRecipeInvocationChat({
				env,
				context,
				user: user as IUser,
				invocation,
				conversationId,
				titleConversation: true,
			});
		} catch (error) {
			const response = await recordRecipeInvocationFailure({
				env,
				context,
				user: user as IUser,
				invocation,
				conversationId,
				error,
			});
			return {
				status: "success",
				message: "Recipe execution failed and was recorded",
				data: {
					...invocation,
					conversationId,
					response,
					error: error instanceof Error ? error.message : String(error),
				},
			};
		}
		let notificationDelivery:
			| { channel: "sms"; status: "sent" }
			| { channel: "sms"; status: "failed"; error: string }
			| undefined;
		if (data.notificationChannel === "sms" && data.notificationTarget?.trim()) {
			const notification = extractChatCompletionNotification(execution.response, {
				fallback: "Recipe execution completed.",
			});
			try {
				await sendRecipeSmsNotification({
					env,
					context,
					user: user as IUser,
					userId: message.user_id,
					to: data.notificationTarget.trim(),
					...notification,
				});
				notificationDelivery = { channel: "sms", status: "sent" };
			} catch (error) {
				const messageText =
					error instanceof Error ? error.message : "Scheduled recipe SMS notification failed";
				logger.warn("Scheduled recipe SMS notification failed", {
					recipeId: data.recipeId,
					userId: message.user_id,
					error: messageText,
				});
				notificationDelivery = {
					channel: "sms",
					status: "failed",
					error: messageText,
				};
			}
		}

		return {
			status: "success",
			message: "Recipe execution completed",
			data: {
				...invocation,
				conversationId: execution.conversationId,
				response: execution.response,
				...(notificationDelivery ? { notificationDelivery } : {}),
			},
		};
	}
}
