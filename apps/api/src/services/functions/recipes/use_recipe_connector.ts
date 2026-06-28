import { recipeConnectorProviderSchema } from "@assistant/schemas";
import {
	isConnectorOperationWrite,
	recipeConnectorOperationIds,
} from "~/lib/providers/capabilities/connectors";
import { executeRecipeConnectorOperation } from "~/services/apps/connectors/operations";
import {
	getRecipeConfiguration,
	getRecipeAllowedConnectorOperations,
	getRecipeAllowedConnectorProviders,
	getRecipeExecutionChannel,
} from "~/services/apps/recipes/toolContext";
import { AssistantError, ErrorType } from "~/utils/errors";
import { isRecord } from "~/utils/objects";
import { jsonSchemaToZod } from "../jsonSchema";
import type { ApiToolDefinition } from "../types";

function buildConnectorToolError(params: {
	provider: string;
	operation: unknown;
	error: AssistantError;
	savedConfiguration?: Record<string, unknown>;
}) {
	const recoverable = params.error.type === ErrorType.PARAMS_ERROR;
	return {
		status: "error",
		name: "use_recipe_connector",
		content: recoverable
			? `${params.error.message}. Retry use_recipe_connector with corrected params. If this is a recipe chat, use the savedConfiguration values from this tool result as defaults.`
			: params.error.message,
		data: {
			provider: params.provider,
			operation: params.operation,
			errorType: params.error.type,
			statusCode: params.error.statusCode,
			...(recoverable
				? {
						recoverable: true,
						...(params.savedConfiguration ? { savedConfiguration: params.savedConfiguration } : {}),
					}
				: {}),
		},
	};
}

function mergeRecipeConfigurationIntoParams(
	params: unknown,
	configuration: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (!configuration) {
		return isRecord(params) ? params : undefined;
	}

	if (!isRecord(params)) {
		return { ...configuration };
	}

	return {
		...configuration,
		...params,
	};
}

export const use_recipe_connector: ApiToolDefinition = {
	name: "use_recipe_connector",
	description:
		"Use a connected recipe provider such as Cloudflare, Fitbit, Gmail, Outlook, Google Calendar, Linear, Netlify, Notion, Oura, PostHog, Sentry, Supabase, Todoist, Vercel, Webflow, or Withings. Only use this when the user has asked for a recipe or connector-backed workflow. In recipe chats, saved recipe configuration is automatically merged into params as defaults; explicit params override saved values.",
	type: "premium",
	costPerCall: 0,
	permissions: ["network", "read", "write"],
	inputSchema: jsonSchemaToZod({
		type: "object",
		properties: {
			provider: {
				type: "string",
				enum: recipeConnectorProviderSchema.options,
				description: "The connected provider to use.",
			},
			operation: {
				type: "string",
				enum: recipeConnectorOperationIds,
				description: "Provider operation supported by the selected connector.",
			},
			params: {
				type: "object",
				description:
					"Provider operation parameters. For PostHog query, pass query as a HogQL string or { kind: 'HogQLQuery', query: string }; projectId, organizationId, and region come from saved recipe configuration when omitted.",
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
		const savedConfiguration = getRecipeConfiguration(request.request?.options);
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
			const params = mergeRecipeConfigurationIntoParams(args.params, savedConfiguration);
			data = await executeRecipeConnectorOperation({
				context: request.context,
				userId: request.user.id,
				request: {
					provider,
					operation: args.operation,
					params,
				},
			});
		} catch (error) {
			if (error instanceof AssistantError) {
				return buildConnectorToolError({
					provider,
					operation: args.operation,
					error,
					savedConfiguration,
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
