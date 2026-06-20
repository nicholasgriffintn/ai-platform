import { recipeConnectorProviderSchema } from "@assistant/schemas";
import {
	isConnectorOperationWrite,
	recipeConnectorOperationIds,
} from "~/lib/providers/capabilities/connectors";
import { executeRecipeConnectorOperation } from "~/services/apps/connectors/operations";
import {
	getRecipeAllowedConnectorOperations,
	getRecipeAllowedConnectorProviders,
	getRecipeExecutionChannel,
} from "~/services/apps/recipes/toolContext";
import { AssistantError } from "~/utils/errors";
import { jsonSchemaToZod } from "../jsonSchema";
import type { ApiToolDefinition } from "../types";

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
