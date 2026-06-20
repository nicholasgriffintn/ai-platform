import {
	recipeConfigurationSchema,
	recipeConnectorProviderSchema,
	recipeInstallationTriggerSchema,
} from "@assistant/schemas";
import {
	isConnectorOperationWrite,
	recipeConnectorOperationIds,
} from "~/lib/providers/capabilities/connectors";
import { executeRecipeConnectorOperation } from "~/services/apps/connectors/operations";
import {
	getAssistantRecipe,
	invokeAssistantRecipe,
	resolveInstalledAssistantRecipe,
	updateRecipeInstallation,
} from "~/services/apps/recipes";
import { getRecipeConversationContext } from "~/services/apps/recipes/conversationContext";
import { executeRecipeInvocationChat } from "~/services/apps/recipes/execution";
import { coerceStringArray, isRecord } from "~/utils/objects";
import { AssistantError } from "~/utils/errors";
import { extractChatCompletionNotification } from "~/utils/messages";
import { jsonSchemaToZod } from "./jsonSchema";
import type { ApiToolDefinition } from "./types";

function getRecipeAllowedConnectorProviders(options: unknown): string[] | null {
	if (!isRecord(options) || !isRecord(options.recipe)) {
		return null;
	}

	return coerceStringArray(options.recipe.allowedConnectorProviders);
}

function getRecipeAllowedConnectorOperations(options: unknown, provider: string): string[] | null {
	if (
		!isRecord(options) ||
		!isRecord(options.recipe) ||
		!isRecord(options.recipe.allowedConnectorOperations) ||
		!(provider in options.recipe.allowedConnectorOperations)
	) {
		return null;
	}

	return coerceStringArray(options.recipe.allowedConnectorOperations[provider]);
}

function getRecipeExecutionChannel(options: unknown): string | undefined {
	if (!isRecord(options) || !isRecord(options.recipe)) {
		return undefined;
	}

	return typeof options.recipe.channel === "string" ? options.recipe.channel : undefined;
}

function getActiveRecipeSetup(options: unknown):
	| {
			id: string;
			installationId?: string;
	  }
	| undefined {
	if (!isRecord(options) || !isRecord(options.recipe) || typeof options.recipe.id !== "string") {
		return undefined;
	}

	return {
		id: options.recipe.id,
		installationId:
			typeof options.recipe.installationId === "string" ? options.recipe.installationId : undefined,
	};
}

function getTriggerRecipeChannel(options: unknown): "sms" | "tool" {
	if (!isRecord(options)) {
		return "tool";
	}

	if (options.source === "sms") {
		return "sms";
	}

	if (isRecord(options.sms) && options.sms.enabled === true) {
		return "sms";
	}

	return "tool";
}

function getSmsRecipeExecutionContext(
	options: unknown,
): { from?: string; to?: string } | undefined {
	if (!isRecord(options) || !isRecord(options.sms) || options.sms.enabled !== true) {
		return undefined;
	}

	return {
		...(typeof options.sms.from === "string" ? { from: options.sms.from } : {}),
		...(typeof options.sms.to === "string" ? { to: options.sms.to } : {}),
	};
}

function buildConnectorToolError(params: {
	provider: string;
	operation: unknown;
	error: AssistantError;
}) {
	return {
		status: "error",
		name: "use_recipe_connector",
		content: params.error.message,
		data: {
			provider: params.provider,
			operation: params.operation,
			errorType: params.error.type,
			statusCode: params.error.statusCode,
		},
	};
}

export const get_recipe: ApiToolDefinition = {
	name: "get_recipe",
	description:
		"Get the active recipe setup contract, including exact configuration field keys, saved configuration, trigger types, and enabled tools. Use this before configure_recipe when setting up or correcting a recipe.",
	type: "premium",
	costPerCall: 0,
	permissions: ["read"],
	inputSchema: jsonSchemaToZod({
		type: "object",
		properties: {
			recipeId: {
				type: "string",
				description:
					"Optional recipe id. Defaults to the active recipe setup chat and must match it when provided.",
			},
		},
	}),
	execute: async (args, context) => {
		const request = context.request;
		if (!request.context || !request.user?.id) {
			throw new Error("Signed-in user context is required for recipe setup tools");
		}

		const activeRecipe = getActiveRecipeSetup(request.request?.options);
		const requestedRecipeId = typeof args.recipeId === "string" ? args.recipeId : undefined;
		const recipeId = requestedRecipeId ?? activeRecipe?.id;
		if (!recipeId) {
			return {
				status: "error",
				name: "get_recipe",
				content: "No active recipe is available in this chat.",
				data: {},
			};
		}

		if (activeRecipe?.id && requestedRecipeId && requestedRecipeId !== activeRecipe.id) {
			return {
				status: "error",
				name: "get_recipe",
				content: "The requested recipe does not match the active recipe setup chat.",
				data: {
					recipeId: requestedRecipeId,
					activeRecipeId: activeRecipe.id,
				},
			};
		}

		const recipe = await getAssistantRecipe(recipeId, {
			context: request.context,
			userId: request.user.id,
			requestUrl: request.app_url,
		});
		if (!recipe) {
			return {
				status: "error",
				name: "get_recipe",
				content: "Recipe not found.",
				data: { recipeId },
			};
		}

		return {
			status: "success",
			name: "get_recipe",
			content: "Recipe configuration fields loaded.",
			data: {
				recipeId: recipe.id,
				title: recipe.title,
				configurationFields: recipe.configurationFields,
				triggers: recipe.triggers,
				enabledTools: recipe.enabledTools,
				savedConfiguration: isRecord(request.request?.options?.recipe)
					? request.request.options.recipe.configuration
					: undefined,
			},
		};
	},
};

export const use_recipe_connector: ApiToolDefinition = {
	name: "use_recipe_connector",
	description:
		"Use a connected recipe provider such as Cloudflare, Fitbit, Gmail, Outlook, Google Calendar, Linear, Netlify, Notion, Oura, PostHog, Sentry, Supabase, Todoist, Vercel, Webflow, or Withings. Only use this when the user has asked for a recipe or connector-backed workflow.",
	type: "premium",
	costPerCall: 0,
	permissions: ["network", "read", "write"],
	inputSchema: jsonSchemaToZod({
		type: "object",
		properties: {
			provider: {
				type: "string",
				enum: [
					"asana",
					"cloudflare",
					"devin",
					"fitbit",
					"gmail",
					"outlook",
					"calendar",
					"linear",
					"netlify",
					"notion",
					"oura",
					"posthog",
					"sentry",
					"supabase",
					"todoist",
					"vercel",
					"webflow",
					"withings",
				],
				description: "The connected provider to use.",
			},
			operation: {
				type: "string",
				enum: recipeConnectorOperationIds,
				description: "Provider operation supported by the selected connector.",
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

		const parsedProvider = recipeConnectorProviderSchema.safeParse(args.provider);
		if (!parsedProvider.success) {
			return {
				status: "error",
				name: "use_recipe_connector",
				content: "Choose a supported recipe connector provider.",
				data: { provider: args.provider },
			};
		}

		const provider = parsedProvider.data;
		const allowedConnectorProviders = getRecipeAllowedConnectorProviders(request.request?.options);
		if (allowedConnectorProviders && !allowedConnectorProviders.includes(provider)) {
			return {
				status: "error",
				name: "use_recipe_connector",
				content: `The ${provider || "requested"} connector is not enabled for this recipe.`,
				data: {
					provider,
					allowedConnectorProviders,
				},
			};
		}

		const allowedConnectorOperations = getRecipeAllowedConnectorOperations(
			request.request?.options,
			provider,
		);
		if (
			allowedConnectorOperations &&
			(typeof args.operation !== "string" || !allowedConnectorOperations.includes(args.operation))
		) {
			return {
				status: "error",
				name: "use_recipe_connector",
				content: `The ${provider || "requested"} connector operation is not enabled for this recipe.`,
				data: {
					provider,
					operation: args.operation,
					allowedConnectorOperations,
				},
			};
		}

		if (
			getRecipeExecutionChannel(request.request?.options) === "scheduled" &&
			typeof args.operation === "string" &&
			isConnectorOperationWrite(provider, args.operation)
		) {
			return {
				status: "error",
				name: "use_recipe_connector",
				content:
					"Scheduled recipe runs cannot perform connector write operations. Ask the user to run this recipe in chat if an external change is required.",
				data: {
					provider,
					operation: args.operation,
					channel: "scheduled",
				},
			};
		}

		let data: unknown;
		try {
			data = await executeRecipeConnectorOperation({
				context: request.context,
				userId: request.user.id,
				request: {
					provider,
					operation: args.operation,
					params: args.params,
				},
			});
		} catch (error) {
			if (error instanceof AssistantError) {
				return buildConnectorToolError({
					provider,
					operation: args.operation,
					error,
				});
			}

			throw error;
		}

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
		const triggerInput =
			typeof args.input === "string" && args.input.trim() ? args.input.trim() : query;
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

		const recipeChannel = getTriggerRecipeChannel(request.request?.options);
		const sms = getSmsRecipeExecutionContext(request.request?.options);
		const invocation = await invokeAssistantRecipe(resolvedRecipeId, {
			context: request.context,
			userId: request.user.id,
			channel: recipeChannel,
			input: triggerInput || undefined,
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
			const priorMessages = await getRecipeConversationContext({
				conversationManager: context.conversationManager,
				conversationId: context.completionId,
			});
			const execution = await executeRecipeInvocationChat({
				env: request.env,
				context: request.context,
				user: request.user,
				invocation,
				priorMessages,
				...(sms ? { sms } : {}),
			});
			const notification = extractChatCompletionNotification(execution.response, {
				streamingMessage: "Recipe execution cannot return a streaming response",
			});

			return {
				status: "success",
				name: "trigger_recipe",
				content: notification.body,
				data: {
					...invocation,
					executionConversationId: execution.conversationId,
					notification,
					mediaUrls: notification.mediaUrls,
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

export const configure_recipe: ApiToolDefinition = {
	name: "configure_recipe",
	description:
		"Save configuration and triggers for the active recipe setup chat after the user confirms the details or asks you to choose sensible defaults. Call get_recipe first if you need the exact configuration field keys.",
	type: "premium",
	costPerCall: 0,
	permissions: ["write"],
	inputSchema: jsonSchemaToZod({
		type: "object",
		properties: {
			recipeId: {
				type: "string",
				description: "Optional active recipe id. Must match the recipe being set up.",
			},
			configuration: {
				type: "object",
				description: "Recipe configuration values to save.",
			},
			triggers: {
				type: "array",
				description:
					"Recipe triggers to save. Include a manual trigger unless the user explicitly disables manual runs.",
				items: {
					type: "object",
					properties: {
						type: {
							type: "string",
							enum: ["manual", "schedule", "natural_language"],
						},
						enabled: {
							type: "boolean",
						},
						cronExpression: {
							type: "string",
							description: "Five-field cron expression for schedule triggers.",
						},
						prompt: {
							type: "string",
							description: "Optional instruction to use when the schedule runs.",
						},
						notificationChannel: {
							type: "string",
							enum: ["sms"],
						},
						notificationTarget: {
							type: "string",
						},
					},
					required: ["type"],
				},
			},
		},
	}),
	execute: async (args, context) => {
		const request = context.request;
		if (!request.context || !request.user?.id) {
			throw new Error("Signed-in user context is required for recipe setup tools");
		}

		const activeRecipe = getActiveRecipeSetup(request.request?.options);
		if (!activeRecipe?.installationId) {
			return {
				status: "error",
				name: "configure_recipe",
				content: "No active installed recipe is available to configure in this chat.",
				data: { recipeId: activeRecipe?.id },
			};
		}

		if (typeof args.recipeId === "string" && args.recipeId !== activeRecipe.id) {
			return {
				status: "error",
				name: "configure_recipe",
				content: "The requested recipe does not match the active recipe setup chat.",
				data: {
					recipeId: args.recipeId,
					activeRecipeId: activeRecipe.id,
				},
			};
		}

		const configuration =
			args.configuration === undefined
				? undefined
				: recipeConfigurationSchema.safeParse(args.configuration);
		if (configuration && !configuration.success) {
			return {
				status: "error",
				name: "configure_recipe",
				content: "Recipe configuration is not valid.",
				data: { issues: configuration.error.issues },
			};
		}

		const triggers =
			args.triggers === undefined
				? undefined
				: recipeInstallationTriggerSchema.array().safeParse(args.triggers);
		if (triggers && !triggers.success) {
			return {
				status: "error",
				name: "configure_recipe",
				content: "Recipe triggers are not valid.",
				data: { issues: triggers.error.issues },
			};
		}

		if (!configuration && !triggers) {
			return {
				status: "error",
				name: "configure_recipe",
				content: "Provide recipe configuration, triggers, or both to save.",
				data: { recipeId: activeRecipe.id },
			};
		}

		let installation;
		try {
			installation = await updateRecipeInstallation({
				context: request.context,
				userId: request.user.id,
				installationId: activeRecipe.installationId,
				update: {
					...(configuration ? { configuration: configuration.data } : {}),
					...(triggers ? { triggers: triggers.data } : {}),
				},
			});
		} catch (error) {
			if (error instanceof AssistantError) {
				return {
					status: "needs_correction",
					name: "configure_recipe",
					content: `${error.message}. Call get_recipe for the exact configuration field keys, then retry configure_recipe.`,
					data: {
						recipeId: activeRecipe.id,
						installationId: activeRecipe.installationId,
						recoverable: true,
					},
				};
			}

			throw error;
		}

		if (!installation) {
			return {
				status: "error",
				name: "configure_recipe",
				content: "Recipe installation not found.",
				data: {
					recipeId: activeRecipe.id,
					installationId: activeRecipe.installationId,
				},
			};
		}

		return {
			status: "success",
			name: "configure_recipe",
			content: "Recipe setup saved.",
			data: { installation },
		};
	},
};
