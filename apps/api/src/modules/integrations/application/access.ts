import { authorise, ownsResource } from "@ngriffin_uk/polychat-library-policy";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireWorkspaceAccess, requireWorkAccess } from "~/modules/workspaces/application/access";

import type { StoredIntegrationDefinition } from "../infrastructure/IntegrationDefinitionRepository";

export async function requireIntegrationDefinition(
  context: ServiceContext,
  id: string,
  action: "read" | "write" = "read",
): Promise<{ definition: StoredIntegrationDefinition; canManage: boolean }> {
  const user = requireWorkAccess(context);
  const definition = await context.repositories.integrationDefinitions.get(id);

  if (!definition || definition.revoked) {
    throw new AssistantError("Integration not found", ErrorType.NOT_FOUND, 404);
  }

  if (!definition.workspaceId) {
    if (!ownsResource(user.id, definition.userId)) {
      throw new AssistantError("Integration not found", ErrorType.NOT_FOUND, 404);
    }

    return { definition, canManage: true };
  }

  const { role } = await requireWorkspaceAccess(context, definition.workspaceId);
  const canManage = authorise("capability.manage", {
    kind: "integration",
    role,
    existing: true,
    actorId: String(user.id),
    creatorId: String(definition.userId),
  }).allowed;

  if (action === "write" && !canManage) {
    throw new AssistantError(
      "Only workspace admins can manage integration definitions",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  return { definition, canManage };
}
