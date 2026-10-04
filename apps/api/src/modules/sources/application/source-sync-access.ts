import {
  CONNECTOR_ACCOUNT_REFERENCE_KIND,
  getConnectorProviderConfig,
  listComposioConnectedAccounts,
  type ComposioConnectedAccount,
} from "@ngriffin_uk/polychat-ai-integrations";
import { authorise, ownsResource } from "@ngriffin_uk/polychat-library-policy";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { SourceSyncRecord } from "~/modules/sources/infrastructure/SourceSyncRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

export async function requireSourceSyncAccess(
  context: ServiceContext,
  sync: SourceSyncRecord,
  manage = false,
): Promise<void> {
  const user = context.requireUser();

  if (!sync.project_id) {
    if (!ownsResource(user.id, sync.created_by_user_id)) {
      throw new AssistantError("Source sync not found", ErrorType.NOT_FOUND, 404);
    }

    return;
  }

  const { role } = await requireProjectAccess(
    context,
    sync.project_id,
    manage ? ["owner", "admin"] : undefined,
  );

  if (
    !authorise(manage ? "resource.write" : "resource.read", {
      actorId: String(user.id),
      ownerId: String(sync.created_by_user_id),
      scope: "project",
      member: true,
      role,
    }).allowed
  ) {
    throw new AssistantError("Source sync access denied", ErrorType.FORBIDDEN, 403);
  }
}

export async function requireSourceSyncAccount(
  context: ServiceContext,
  connectionId: string,
): Promise<ComposioConnectedAccount> {
  const user = context.requireUser();
  const connection = await context.repositories.providerConnections.getConnectionById(connectionId);
  const provider = getConnectorProviderConfig("googledrive");

  if (
    !connection ||
    !ownsResource(user.id, connection.user_id) ||
    connection.provider !== "googledrive" ||
    connection.kind !== CONNECTOR_ACCOUNT_REFERENCE_KIND ||
    connection.status !== "connected" ||
    !provider ||
    provider.auth.authType !== "composio"
  ) {
    throw new AssistantError("Connected Drive account is unavailable", ErrorType.FORBIDDEN, 403);
  }

  if (
    !authorise("connector.unattended", { supported: true, access: "read", destructive: false })
      .allowed
  ) {
    throw new AssistantError("Unattended indexing is not allowed", ErrorType.FORBIDDEN, 403);
  }

  const accounts = await listComposioConnectedAccounts({
    env: context.env,
    userId: user.id,
    toolkitSlugs: [provider.auth.toolkitSlug],
    connectedAccountIds: [connection.external_id],
    authConfigIds: provider.auth.authConfigs.map((config) => config.id),
  });
  const account = accounts.find(
    (candidate) =>
      candidate.id === connection.external_id &&
      candidate.status === "ACTIVE" &&
      !candidate.isDisabled,
  );

  if (!account) {
    throw new AssistantError("Connected Drive account was revoked", ErrorType.FORBIDDEN, 403);
  }

  return account;
}
