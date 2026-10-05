import { isConnectorOperationSupported } from "@ngriffin_uk/polychat-ai-integrations";
import {
  connectorGrantSchema,
  recipeConnectorProviderSchema,
  type RecipeConnectorProvider,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

export function parseProjectConnectorGrant(
  providerId: string,
  configuration: unknown,
): { provider: RecipeConnectorProvider; operations: string[] } | null {
  const provider = recipeConnectorProviderSchema.safeParse(providerId);
  const grant = connectorGrantSchema.safeParse(configuration);

  if (
    !provider.success ||
    !grant.success ||
    grant.data.operations.some(
      (operation) => !isConnectorOperationSupported(provider.data, operation),
    )
  ) {
    return null;
  }

  return { provider: provider.data, operations: [...new Set(grant.data.operations)] };
}

export function validateProjectConnectorGrant(providerId: string, configuration: unknown) {
  const grant = parseProjectConnectorGrant(providerId, configuration);

  if (!grant) {
    throw new AssistantError(
      "Choose exact actions supported by this connector",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return { operations: grant.operations };
}
