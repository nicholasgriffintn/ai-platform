import { CONNECTOR_ACCOUNT_REFERENCE_KIND } from "@ngriffin_uk/polychat-ai-integrations";
import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import { CONFLUENCE_KNOWLEDGE_RECIPE_ID } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireProjectCapabilityAccess } from "~/modules/workspaces/application/access";

import type { KnowledgeSyncRecord } from "../infrastructure/KnowledgeSyncRepository";

export async function requireKnowledgeSyncAuthority(
  context: ServiceContext,
  sync: KnowledgeSyncRecord,
) {
  const userId = context.requireUser().id;

  if (!ownsResource(userId, sync.user_id)) {
    throw new AssistantError("Knowledge sync not found", ErrorType.NOT_FOUND, 404);
  }

  await requireProjectCapabilityAccess(
    context,
    sync.project_id,
    "recipe",
    CONFLUENCE_KNOWLEDGE_RECIPE_ID,
  );
  const connection = await context.repositories.providerConnections.getConnectionById(
    sync.connection_id,
  );

  if (
    !connection ||
    !ownsResource(userId, connection.user_id) ||
    connection.provider !== "confluence" ||
    connection.kind !== CONNECTOR_ACCOUNT_REFERENCE_KIND ||
    connection.status !== "connected"
  ) {
    throw new AssistantError(
      "Reconnect the Confluence account used by this sync",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  return connection;
}
