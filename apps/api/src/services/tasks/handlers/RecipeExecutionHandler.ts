import { createServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import {
	getMessagingProviderFromStoredCredential,
	selectConfiguredMessagingProviderId,
} from "~/lib/providers/capabilities/messaging/delivery";
import { executeRecipeInvocationChat } from "~/services/apps/recipes/execution";
import { invokeAssistantRecipe } from "~/services/apps/recipes";
import type { IEnv, IUser } from "~/types";
import { extractChatCompletionText } from "~/utils/messages";
import type { TaskHandler, TaskResult } from "../TaskHandler";
import type { TaskMessage } from "../TaskService";

interface RecipeExecutionTaskData {
	recipeId: string;
	input?: string;
	channel?: "web" | "ios" | "sms" | "scheduled" | "tool";
	configuration?: Record<string, unknown>;
	notificationChannel?: "sms";
	notificationTarget?: string;
}

async function sendRecipeSmsNotification(params: {
	env: IEnv;
	context: ServiceContext;
	user: IUser;
	userId: number;
	to: string;
	body: string;
}): Promise<void> {
	const providerId = selectConfiguredMessagingProviderId(
		await params.context.repositories.userSettings.getUserProviderSettings(params.userId),
	);
	if (!providerId) {
		throw new Error("No configured SMS provider found for scheduled recipe notification");
	}

	const encryptedValue = await params.context.repositories.userSettings.getProviderApiKey(
		params.userId,
		providerId,
	);
	if (!encryptedValue) {
		throw new Error("SMS provider credentials are not configured");
	}

	const provider = getMessagingProviderFromStoredCredential({
		providerId,
		value: encryptedValue,
		env: params.env,
		user: params.user,
	});
	await provider.send({ to: params.to, body: params.body });
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

		const execution = await executeRecipeInvocationChat({
			env,
			context,
			user: user as IUser,
			invocation,
		});
		if (data.notificationChannel === "sms" && data.notificationTarget?.trim()) {
			await sendRecipeSmsNotification({
				env,
				context,
				user: user as IUser,
				userId: message.user_id,
				to: data.notificationTarget.trim(),
				body: extractChatCompletionText(execution.response, {
					fallback: "Recipe execution completed.",
				}),
			});
		}

		return {
			status: "success",
			message: "Recipe execution completed",
			data: {
				...invocation,
				conversationId: execution.conversationId,
				response: execution.response,
			},
		};
	}
}
