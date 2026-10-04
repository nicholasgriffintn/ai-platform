import { getConnectorProviderConfig } from "@ngriffin_uk/polychat-ai-integrations";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireWorkAccess } from "~/modules/workspaces/application/access";

export function listConnectorGrantOperations(context: ServiceContext, providerId: string) {
  requireWorkAccess(context);
  const provider = getConnectorProviderConfig(providerId);

  if (!provider) {
    throw new AssistantError("Unknown integration", ErrorType.NOT_FOUND, 404);
  }

  return {
    operations: provider.operations.map((operation) => ({
      id: operation.id,
      access: operation.access,
      destructive: operation.destructive === true,
    })),
  };
}
