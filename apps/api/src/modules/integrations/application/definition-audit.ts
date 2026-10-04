import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import type { StoredIntegrationDefinition } from "../infrastructure/IntegrationDefinitionRepository";

export async function recordIntegrationDefinitionAudit(
  context: ServiceContext,
  definition: StoredIntegrationDefinition,
  action: "created" | "reviewed" | "revoked",
): Promise<void> {
  if (!definition.workspaceId) {
    return;
  }

  await context.repositories.audit.createRecord({
    workspaceId: definition.workspaceId,
    actorUserId: context.requireUser().id,
    action: `integration.definition.${action}`,
    targetType: "integration_definition",
    targetId: definition.id,
    metadata: { revision: definition.revision, digest: definition.snapshot.digest },
  });
}
