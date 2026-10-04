import type { CreateSourceSyncInput } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  requireKnowledgeConnectorSession,
  selectKnowledgeConnectorConnection,
} from "~/modules/apps/application/connectors/knowledge";
import { recordProjectAudit } from "~/modules/audit/application";
import { SourceSyncRepository } from "~/modules/sources/infrastructure/SourceSyncRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { requireSourceSyncAccess } from "./source-sync-access";

export async function createSourceSync(context: ServiceContext, input: CreateSourceSyncInput) {
  const user = context.requireUser();

  if (input.projectId) {
    await requireProjectAccess(context, input.projectId, ["owner", "admin"]);
  }

  const connection = await selectKnowledgeConnectorConnection(
    context,
    input.provider,
    input.accountId,
  );
  const { adapter, read } = await requireKnowledgeConnectorSession(
    context,
    connection.id,
    input.provider,
  );
  const rootId = adapter.normaliseRoot(input.rootId);

  await adapter.validateRoot(read, rootId);

  if (input.projectId) {
    await requireProjectAccess(context, input.projectId, ["owner", "admin"]);
  }

  await requireKnowledgeConnectorSession(context, connection.id, input.provider);
  const sync = await new SourceSyncRepository(context.env).create(
    user.id,
    { ...input, rootId },
    connection.id,
  );

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
