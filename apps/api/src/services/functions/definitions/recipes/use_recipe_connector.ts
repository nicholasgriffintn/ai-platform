import {
  recipeConnectorProviderSchema,
  type RecipeConnectorProvider,
} from "@ngriffin_uk/polychat-schemas";

import { COMPOSIO_CONNECTOR_SESSION_HANDLE_PATTERN } from "~/lib/providers/capabilities/connectors/composio/session-handle";

import { jsonSchemaToZod } from "../../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "../types";

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
            ? `Use the connected provider: ${providers[0]}.`
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
    "Discover and use the exact tools available from a connector. Start with useCase to receive authoritative Composio schemas and a sessionId, then call again with an exact operation, its params, and that sessionId. Treat identifiers as operation-specific: never pass an ID returned by one operation to another unless their schemas explicitly describe the same identifier. Recipe configuration is merged into execution params as defaults.",
  type: "premium",
  permissions: ["network", "read"],
  inputSchema: createUseRecipeConnectorInputSchema(),
};
