import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { requireIntegrationDefinition } from "./access";
import { recordIntegrationDefinitionAudit } from "./definition-audit";

export async function revokeNativeIntegrationDefinition(context: ServiceContext, id: string) {
  const { definition } = await requireIntegrationDefinition(context, id, "write");

  await context.repositories.integrationDefinitions.revoke(definition.id);
  await recordIntegrationDefinitionAudit(context, definition, "revoked");

  return { success: true };
}
