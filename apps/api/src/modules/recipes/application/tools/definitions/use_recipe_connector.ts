import {
  COMPOSIO_CONNECTOR_SESSION_HANDLE_PATTERN,
  getConnectorProviderConfig,
} from "@ngriffin_uk/polychat-ai-integrations";
import { jsonSchemaToZod } from "@ngriffin_uk/polychat-library-tools";
import {
  recipeConnectorProviderSchema,
  type RecipeConnectorProvider,
} from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "~/types/functions";

function describeProviders(providers: readonly RecipeConnectorProvider[]): string {
  return providers
    .map((provider) => {
      const config = getConnectorProviderConfig(provider);

      return config ? `${provider}: ${config.description}` : provider;
    })
    .join("\n");
}

export function createUseRecipeConnectorInputSchema(
  providers?: readonly RecipeConnectorProvider[],
) {
  const connected = providers ?? recipeConnectorProviderSchema.options;
  const summary =
    connected.length === 1
      ? `Use the connected provider: ${connected[0]}.`
      : "The connected provider to use.";

  return jsonSchemaToZod({
    type: "object",
    properties: {
      provider: {
        type: "string",
        enum: [...connected],
        description: providers ? `${summary}\n${describeProviders(providers)}` : summary,
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
        pattern: COMPOSIO_CONNECTOR_SESSION_HANDLE_PATTERN,
        description: "The opaque session handle returned by a preceding discovery call.",
      },
      params: {
        type: "object",
        description: "Parameters matching the exact schema returned by connector discovery.",
      },
    },
    required: ["provider"],
    additionalProperties: false,
  });
}

export const use_recipe_connector: FunctionToolDescriptor = {
  name: "use_recipe_connector",
  maxIdenticalCalls: 2,
  description:
    "Discover and use the exact tools available from a connector. Start with useCase to receive the operations and their schemas (and, for Composio connectors, a sessionId), then call again with an exact operation, its params, and that sessionId where one was given. Treat identifiers as operation-specific: never pass an ID returned by one operation to another unless their schemas explicitly describe the same identifier. Recipe configuration is merged into execution params as defaults.",
  type: "premium",
  permissions: ["network", "read", "write"],
  effects: {
    effectClass: (input) => (input.operation ? "write" : "read"),
    destination: (input) => input.provider,
  },
  intentEvidence: (input) => ({
    operation: input.operation ?? "discover_connector_operation",
    provider: input.provider,
    useCase: input.useCase,
    parameterNames: Object.keys(input.params ?? {}),
  }),
  inputSchema: createUseRecipeConnectorInputSchema(),
};
