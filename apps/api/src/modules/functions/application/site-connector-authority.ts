import { operationIsGranted } from "@ngriffin_uk/polychat-library-policy";
import {
  recipeConnectorProviderSchema,
  teammateRunConfigurationSchema,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import {
  getRecipeAllowedConnectorOperations,
  getRecipeAllowedConnectorProviders,
} from "~/modules/apps/application/recipes/toolContext";
import { resolveTeammateConnectorAuthority } from "~/modules/teammates/application/connection-authority";
import type { ApiToolExecutionContext } from "~/types/functions";

export function siteConnectorAuthority(toolContext: ApiToolExecutionContext) {
  return async (providerId: string, operation: string, connectedAccountId: string) => {
    const request = toolContext.request;
    const provider = recipeConnectorProviderSchema.parse(providerId);
    const providers = getRecipeAllowedConnectorProviders(request.request?.options);
    const operations = getRecipeAllowedConnectorOperations(request.request?.options, provider);

    if (
      (providers && !providers.includes(provider)) ||
      (operations && !operationIsGranted(operations, operation))
    ) {
      throw new AssistantError(
        "This connector operation is outside the active recipe",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    if (request.request?.teammate_context_id && request.context && request.user) {
      const configuration = teammateRunConfigurationSchema.safeParse(
        request.request.resolved_configuration,
      );
      const authority = await resolveTeammateConnectorAuthority({
        context: request.context,
        contextId: request.request.teammate_context_id,
        userId: request.user.id,
        provider,
        admittedGrants: configuration.success ? configuration.data.connectionGrants : [],
      });

      if (
        authority.connectedAccountId !== connectedAccountId ||
        !operationIsGranted(authority.allowedOperations, operation)
      ) {
        throw new AssistantError(
          "This account or operation is outside the teammate grant",
          ErrorType.FORBIDDEN,
          403,
        );
      }
    }
  };
}
