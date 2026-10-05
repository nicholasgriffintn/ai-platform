import { isConnectorOperationSupported } from "@ngriffin_uk/polychat-ai-integrations";
import { connectorGrantSchema, recipeConnectorProviderSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

export function validateProjectConnectorGrant(providerId: string, configuration: unknown) {
  const provider = recipeConnectorProviderSchema.safeParse(providerId);
  const grant = connectorGrantSchema.safeParse(configuration);

  if (
    !provider.success ||
    !grant.success ||
    grant.data.operations.some(
      (operation) => !isConnectorOperationSupported(provider.data, operation),
    )
  ) {
    throw new AssistantError(
      "Choose exact actions supported by this connector",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return { operations: [...new Set(grant.data.operations)] };
}
