import { createServiceContext } from "~/lib/context/serviceContext";
import { executeRecipeInvocationChat } from "~/services/apps/recipes/execution";
import { invokeAssistantRecipe } from "~/services/apps/recipes";
import type { IEnv, IUser } from "~/types";
import type { TaskHandler, TaskResult } from "../TaskHandler";
import type { TaskMessage } from "../TaskService";

interface RecipeExecutionTaskData {
	recipeId: string;
	input?: string;
	channel?: "web" | "ios" | "sms" | "scheduled" | "tool";
	configuration?: Record<string, unknown>;
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
