import { recipeConnectorProviderSchema, type RecipeConnectorProvider } from "@assistant/schemas";
import {
	getConnectorProviderConfig,
	isConnectorOperationWrite,
} from "~/lib/providers/capabilities/connectors";
import {
	discoverRecipeConnectorTools,
	executeRecipeConnectorOperation,
} from "~/services/apps/connectors/operations";
import {
	getRecipeConfiguration,
	getRecipeAllowedConnectorOperations,
	getRecipeAllowedConnectorProviders,
	getRecipeExecutionChannel,
} from "~/services/apps/recipes/toolContext";
import { AssistantError, ErrorType } from "~/utils/errors";
import { isRecord } from "~/utils/objects";
import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { ApiToolDefinition } from "../../../types/functions";

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

export function createUseRecipeConnectorInputSchema(
	providers: readonly RecipeConnectorProvider[] = recipeConnectorProviderSchema.options,
) {
	return jsonSchemaToZod({
		type: "object",
		properties: {
			provider: {
				type: "string",
				enum: [...providers],
				description:
					providers.length === 1
						? `Use the connector selected by the user: ${providers[0]}.`
						: "The connected provider to use.",
			},
			operation: {
				type: "string",
				description: "The exact operation ID returned by connector discovery.",
			},
			useCase: {
				type: "string",
				minLength: 3,
				maxLength: 1000,
				description:
					"Describe the connector task to discover the best exact tools and their current schemas.",
			},
			sessionId: {
				type: "string",
				pattern: "^trs_[A-Za-z0-9_-]+$",
				description: "The scoped sessionId returned by a preceding discovery call.",
			},
			params: {
				type: "object",
				description:
					"Provider operation parameters. For PostHog query, pass query as a HogQL string or { kind: 'HogQLQuery', query: string }; projectId, organizationId, and region come from saved recipe configuration when omitted.",
			},
		},
		required: ["provider"],
	});
}

export const use_recipe_connector: ApiToolDefinition = {
	name: "use_recipe_connector",
	description:
		"Discover and use the exact tools available from a connector. Start with useCase to receive authoritative Composio schemas and a sessionId, then call again with an exact operation, its params, and that sessionId. Treat identifiers as operation-specific: never pass an ID returned by one operation to another unless their schemas explicitly describe the same identifier. Recipe configuration is merged into execution params as defaults.",
	type: "premium",
	costPerCall: 0,
	permissions: ["network", "read", "write"],
	inputSchema: createUseRecipeConnectorInputSchema(),
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
		const providerConfig = getConnectorProviderConfig(provider);
		const effectiveAllowedOperations =
			allowedConnectorOperations ??
			providerConfig?.operations.map((operation) => operation.id) ??
			[];
		const operation = typeof args.operation === "string" ? args.operation.trim() : "";
		const useCase = typeof args.useCase === "string" ? args.useCase.trim() : "";
		if (!operation && !useCase) {
			return {
				status: "error",
				name: "use_recipe_connector",
				content: "Provide useCase to discover tools, or operation to execute a discovered tool.",
				data: { provider },
			};
		}
		if (operation && !effectiveAllowedOperations.includes(operation)) {
			return {
				status: "error",
				name: "use_recipe_connector",
				content: `The ${provider || "requested"} connector operation is not enabled for this recipe.`,
				data: {
					provider,
					operation,
					allowedConnectorOperations: effectiveAllowedOperations,
				},
			};
		}

		if (!operation) {
			try {
				const discovery = await discoverRecipeConnectorTools({
					context: request.context,
					userId: request.user.id,
					provider,
					useCase,
					allowedOperations: effectiveAllowedOperations,
				});
				return {
					status: "success",
					name: "use_recipe_connector",
					content:
						"Connector tools discovered. Choose the exact operation and pass its schema-valid params with this sessionId. Identifiers are operation-specific unless the schemas explicitly describe the same identifier.",
					data: discovery,
				};
			} catch (error) {
				if (error instanceof AssistantError) {
					return buildConnectorToolError({ provider, operation: "discover", error });
				}
				throw error;
			}
		}

		if (
			getRecipeExecutionChannel(request.request?.options) === "scheduled" &&
			isConnectorOperationWrite(provider, operation)
		) {
			return {
				status: "error",
				name: "use_recipe_connector",
				content:
					"Scheduled recipe runs cannot perform connector write operations. Ask the user to run this recipe in chat if an external change is required.",
				data: {
					provider,
					operation,
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
					operation,
					params,
					sessionId: typeof args.sessionId === "string" ? args.sessionId : undefined,
				},
			});
		} catch (error) {
			if (error instanceof AssistantError) {
				return buildConnectorToolError({
					provider,
					operation,
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
