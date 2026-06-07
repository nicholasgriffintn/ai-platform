import { executeRecipeConnectorOperation } from "~/services/apps/connectors/operations";
import { invokeAssistantRecipe, resolveInstalledAssistantRecipe } from "~/services/apps/recipes";
import { executeRecipeInvocationChat } from "~/services/apps/recipes/execution";
import { extractChatCompletionText } from "~/utils/messages";
import { jsonSchemaToZod } from "./jsonSchema";
import type { ApiToolDefinition } from "./types";

export const use_recipe_connector: ApiToolDefinition = {
	name: "use_recipe_connector",
	description:
		"Use a connected recipe provider such as Gmail, Outlook, Google Calendar, Linear, Notion, or Oura. Only use this when the user has asked for a recipe or connector-backed workflow.",
	type: "premium",
	costPerCall: 0,
	permissions: ["network", "read", "write"],
	inputSchema: jsonSchemaToZod({
		type: "object",
		properties: {
			provider: {
				type: "string",
				enum: ["gmail", "outlook", "calendar", "linear", "notion", "oura"],
				description: "The connected provider to use.",
			},
			operation: {
				type: "string",
				description:
					"Provider operation. Supported examples: search_messages, create_draft, list_events, create_event, create_calendar_event, search_issues, create_issue, search, retrieve_page, create_page, append_block_children, daily_readiness, daily_sleep, daily_activity.",
			},
			params: {
				type: "object",
				description: "Provider operation parameters.",
			},
		},
		required: ["provider", "operation"],
	}),
	execute: async (args, context) => {
		const request = context.request;
		if (!request.context || !request.user?.id) {
			throw new Error("Signed-in user context is required for recipe connector tools");
		}

		const data = await executeRecipeConnectorOperation({
			context: request.context,
			userId: request.user.id,
			request: {
				provider: args.provider,
				operation: args.operation,
				params: args.params,
			},
		});

		return {
			status: "success",
			name: "use_recipe_connector",
			content: "Connector operation completed",
			data,
		};
	},
};

export const trigger_recipe: ApiToolDefinition = {
	name: "trigger_recipe",
	description:
		"Trigger an installed recipe when the user's message asks to run a recipe or automation. Prefer query for natural language requests; use recipeId only when the exact installed recipe id is known.",
	type: "premium",
	isDefault: true,
	costPerCall: 0,
	permissions: ["read", "write"],
	inputSchema: jsonSchemaToZod({
		type: "object",
		properties: {
			recipeId: {
				type: "string",
				description: "Optional exact installed recipe id to trigger.",
			},
			query: {
				type: "string",
				description:
					"Natural language recipe name or request, for example 'run my bad weather alert'.",
			},
			input: {
				type: "string",
				description: "Optional user instruction or trigger context for the recipe.",
			},
		},
	}),
	execute: async (args, context) => {
		const request = context.request;
		if (!request.context || !request.user?.id) {
			throw new Error("Signed-in user context is required for recipe tools");
		}

		const explicitRecipeId = typeof args.recipeId === "string" ? args.recipeId.trim() : "";
		const query =
			typeof args.query === "string" && args.query.trim()
				? args.query.trim()
				: typeof args.input === "string"
					? args.input.trim()
					: "";
		if (!explicitRecipeId && !query) {
			return {
				status: "error",
				name: "trigger_recipe",
				content: "Provide a recipe id or describe which installed recipe to trigger.",
				data: { candidates: [] },
			};
		}

		let resolvedRecipeId = explicitRecipeId;
		if (!resolvedRecipeId) {
			const match = await resolveInstalledAssistantRecipe({
				context: request.context,
				userId: request.user.id,
				query,
			});

			if (match.status === "matched" && match.recipe) {
				resolvedRecipeId = match.recipe.id;
			} else {
				return {
					status: "error",
					name: "trigger_recipe",
					content:
						match.status === "ambiguous"
							? "That recipe request matches more than one installed recipe. Ask which recipe to run."
							: "I could not find a matching installed recipe.",
					data: { query, candidates: match.candidates },
				};
			}
		}

		const invocation = await invokeAssistantRecipe(resolvedRecipeId, {
			context: request.context,
			userId: request.user.id,
			channel: "tool",
			input: args.input,
			requireInstalled: true,
		});

		if (!invocation) {
			return {
				status: "error",
				name: "trigger_recipe",
				content: "Recipe not found",
				data: { recipeId: resolvedRecipeId },
			};
		}

		if (invocation.status === "ready") {
			const execution = await executeRecipeInvocationChat({
				env: request.env,
				context: request.context,
				user: request.user,
				invocation,
			});
			const content = extractChatCompletionText(execution.response, {
				streamingMessage: "Recipe execution cannot return a streaming response",
			});

			return {
				status: "success",
				name: "trigger_recipe",
				content,
				data: {
					...invocation,
					executionConversationId: execution.conversationId,
				},
			};
		}

		return {
			status:
				invocation.status === "blocked" || invocation.status === "not_installed"
					? "error"
					: "success",
			name: "trigger_recipe",
			content: invocation.conversationStarter,
			data: invocation,
		};
	},
};
