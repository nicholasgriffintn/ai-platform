import { getConnectorProviderConfig } from "@ngriffin_uk/polychat-ai-integrations";
import { authorise } from "@ngriffin_uk/polychat-library-policy";
import {
  connectorGrantSchema,
  integrationGrantSchema,
  type ProjectCapabilityKind,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

export async function validateProjectIntegrationGrant(params: {
  context: ServiceContext;
  workspaceId: string;
  kind: ProjectCapabilityKind;
  capabilityId: string;
  configuration: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  if (params.kind === "connector") {
    const provider = getConnectorProviderConfig(params.capabilityId);
    const grant = connectorGrantSchema.safeParse(params.configuration);

    if (
      !grant.success ||
      !provider ||
      grant.data.operations.some(
        (id) => !provider.operations.some((operation) => operation.id === id),
      )
    ) {
      throw new AssistantError(
        "Grant exact operations from the integration catalogue",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    return { operations: [...new Set(grant.data.operations)].sort() };
  }

  if (params.kind !== "integration") {
    return params.configuration;
  }

  const definition = await params.context.repositories.integrationDefinitions.get(
    params.capabilityId,
  );
  const grant = integrationGrantSchema.safeParse(params.configuration);

  if (
    !authorise("capability.use", {
      granted: Boolean(definition),
      excluded: definition?.revoked ?? false,
    }).allowed ||
    !definition ||
    !grant.success ||
    definition.workspaceId !== params.workspaceId ||
    definition.revision !== grant.data.revision ||
    grant.data.operations.some((id) => !definition.snapshot.tools.some((tool) => tool.name === id))
  ) {
    throw new AssistantError(
      "Review the current workspace integration before granting its tools",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return { revision: grant.data.revision, operations: [...new Set(grant.data.operations)].sort() };
}
