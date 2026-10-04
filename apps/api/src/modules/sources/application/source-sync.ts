import {
  createKnowledgeProxyReader,
  CONNECTOR_ACCOUNT_REFERENCE_KIND,
} from "@ngriffin_uk/polychat-ai-integrations";
import {
  driveKnowledgeFolderSchema,
  type CreateSourceSyncInput,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { listRecipeConnectorAccounts } from "~/modules/apps/application/connectors/accounts";
import { recordProjectAudit } from "~/modules/audit/application";
import { SourceSyncRepository } from "~/modules/sources/infrastructure/SourceSyncRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { requireSourceSyncAccess, requireSourceSyncAccount } from "./source-sync-access";

export async function createSourceSync(context: ServiceContext, input: CreateSourceSyncInput) {
  const user = context.requireUser();

  if (input.projectId) {
    await requireProjectAccess(context, input.projectId, ["owner", "admin"]);
  }

  await listRecipeConnectorAccounts({ context, userId: user.id, providerId: "googledrive" });
  const connection = await context.repositories.providerConnections.getConnection(
    user.id,
    "googledrive",
    CONNECTOR_ACCOUNT_REFERENCE_KIND,
    input.accountId,
  );

  if (!connection) {
    throw new AssistantError("Select a connected Drive account", ErrorType.PARAMS_ERROR, 400);
  }

  const account = await requireSourceSyncAccount(context, connection.id);
  const read = createKnowledgeProxyReader(context.env, account.id);
  const root = driveKnowledgeFolderSchema.parse(
    await read(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.rootId)}?fields=id,mimeType,trashed&supportsAllDrives=true`,
    ),
  );

  if (root.trashed || root.id !== input.rootId) {
    throw new AssistantError("Select an accessible Drive folder", ErrorType.PARAMS_ERROR, 400);
  }

  if (input.projectId) {
    await requireProjectAccess(context, input.projectId, ["owner", "admin"]);
  }

  await requireSourceSyncAccount(context, connection.id);
  const sync = await new SourceSyncRepository(context.env).create(user.id, input, connection.id);

  if (sync.project_id) {
    await recordProjectAudit(context, sync.project_id, {
      actorUserId: user.id,
      action: "source.sync-created",
      targetType: "source-sync",
      targetId: sync.id,
    });
  }

  return listSourceSyncs(context, input.projectId);
}

export async function listSourceSyncs(context: ServiceContext, projectId?: string) {
  if (projectId) {
    await requireProjectAccess(context, projectId);
  }

  return {
    syncs: await new SourceSyncRepository(context.env).list(context.requireUser().id, projectId),
  };
}

export async function updateSourceSync(context: ServiceContext, syncId: string, enabled: boolean) {
  const repository = new SourceSyncRepository(context.env);
  const sync = await repository.get(syncId);

  if (!sync) {
    throw new AssistantError("Source sync not found", ErrorType.NOT_FOUND, 404);
  }

  await requireSourceSyncAccess(context, sync, true);
  await repository.setEnabled(syncId, enabled);

  if (sync.project_id) {
    await recordProjectAudit(context, sync.project_id, {
      actorUserId: context.requireUser().id,
      action: enabled ? "source.sync-resumed" : "source.sync-paused",
      targetType: "source-sync",
      targetId: sync.id,
    });
  }

  return listSourceSyncs(context, sync.project_id ?? undefined);
}

export async function deleteSourceSync(
  context: ServiceContext,
  syncId: string,
): Promise<{ deleted: true }> {
  const repository = new SourceSyncRepository(context.env);
  const sync = await repository.get(syncId);

  if (!sync) {
    throw new AssistantError("Source sync not found", ErrorType.NOT_FOUND, 404);
  }

  await requireSourceSyncAccess(context, sync, true);
  await repository.remove(sync.id);

  if (sync.project_id) {
    await recordProjectAudit(context, sync.project_id, {
      actorUserId: context.requireUser().id,
      action: "source.sync-deleted",
      targetType: "source-sync",
      targetId: sync.id,
    });
  }

  return { deleted: true };
}
