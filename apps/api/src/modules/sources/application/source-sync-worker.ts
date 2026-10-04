import type { KnowledgeConnectorSession } from "@ngriffin_uk/polychat-ai-integrations";
import {
  SOURCE_SYNC_TASK_TYPE,
  sourceSyncCheckpointSchema,
  knowledgeDocumentPermissionsSchema,
  knowledgeSyncPageSchema,
  type KnowledgeSyncDocument,
} from "@ngriffin_uk/polychat-schemas";
import { generatePrefixedId, safeParseJson } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { getRecipeConnectorProviderConfig } from "~/modules/apps/application/connectors/connector-adapters";
import { requireKnowledgeConnectorSession } from "~/modules/apps/application/connectors/knowledge";
import {
  SourceSyncRepository,
  type SourceSyncRecord,
} from "~/modules/sources/infrastructure/SourceSyncRepository";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { IEnv } from "~/types";

import { requireSourceSyncAccess } from "./source-sync-access";

async function enqueueSyncPage(context: ServiceContext, sync: SourceSyncRecord): Promise<void> {
  if (!sync.run_id) {
    return;
  }

  await new TaskService(context.env, context.repositories.tasks).enqueueTask({
    id: `source_sync_${sync.id}_${sync.run_id}_${sync.page}`,
    task_type: SOURCE_SYNC_TASK_TYPE,
    user_id: sync.created_by_user_id,
    project_id: sync.project_id ?? undefined,
    task_data: { syncId: sync.id, runId: sync.run_id, page: sync.page },
  });
}

export async function scheduleSourceSyncs(env: IEnv): Promise<void> {
  const context = createServiceContext({ env });
  const repository = new SourceSyncRepository(env);

  for (const sync of await repository.listDue()) {
    const adapter = getRecipeConnectorProviderConfig(sync.provider)?.knowledge;

    if (!adapter) {
      continue;
    }

    if (!sync.run_id) {
      await repository.begin(
        sync.id,
        generatePrefixedId("scan_"),
        sourceSyncCheckpointSchema.parse(adapter.initialCheckpoint(sync.root_id)),
      );
    }

    const current = await repository.get(sync.id);

    if (current?.enabled) {
      await enqueueSyncPage(context, current);
    }
  }
}

async function refreshDocument(
  context: ServiceContext,
  sync: SourceSyncRecord,
  runId: string,
  page: number,
  document: KnowledgeSyncDocument,
  session: KnowledgeConnectorSession,
  assertOwned: () => Promise<void>,
): Promise<void> {
  const repository = new SourceSyncRepository(context.env);
  const { adapter, read } = session;

  await assertOwned();
  await requireSourceSyncAccess(context, sync, true);
  await repository.invalidatePermissions(sync.id, document.id, runId, page);

  try {
    const permissions = knowledgeDocumentPermissionsSchema.parse(
      await adapter.getPermissions(read, document),
    );
    const previous = await repository.getSyncedSource(sync.id, document.id);
    const cachedContent =
      document.version && previous?.upstream_version === document.version
        ? (previous.content ?? undefined)
        : undefined;
    const content = await adapter.readContent(read, document, cachedContent);

    if (new TextEncoder().encode(content).length > 256 * 1024) {
      throw new AssistantError(
        "Knowledge document exceeds the indexing size limit",
        ErrorType.PARAMS_ERROR,
        413,
      );
    }

    if (!content.trim()) {
      throw new AssistantError(
        "Knowledge document has no supported text",
        ErrorType.PARAMS_ERROR,
        422,
      );
    }

    await assertOwned();
    await requireSourceSyncAccess(context, sync, true);
    await repository.storeDocument({
      sync,
      runId,
      page,
      upstreamId: document.id,
      version: document.version,
      title: document.title,
      content,
      permissions,
      sourceUrl: document.sourceUrl,
    });
  } catch (error) {
    if (
      error instanceof AssistantError &&
      [401, 403, 404, 413, 422].includes(error.statusCode ?? 0)
    ) {
      await assertOwned();
      await repository.archiveDocument(sync.id, document.id, runId, page);

      return;
    }

    throw error;
  }
}

export async function runSourceSyncPage(
  context: ServiceContext,
  input: { syncId: string; runId: string; page: number },
  assertOwned: () => Promise<void>,
): Promise<void> {
  const repository = new SourceSyncRepository(context.env);
  const sync = await repository.get(input.syncId);

  if (!sync?.enabled || sync.run_id !== input.runId || sync.page !== input.page) {
    return;
  }

  if (context.requireUser().id !== sync.created_by_user_id) {
    throw new AssistantError("Source sync owner mismatch", ErrorType.FORBIDDEN, 403);
  }

  try {
    await assertOwned();
    await requireSourceSyncAccess(context, sync, true);
    const session = await requireKnowledgeConnectorSession(
      context,
      sync.connection_id,
      sync.provider,
    );
    const checkpoint = sourceSyncCheckpointSchema.parse(safeParseJson(sync.checkpoint));
    const result = knowledgeSyncPageSchema.parse(
      await session.adapter.listDocuments(session.read, checkpoint),
    );

    for (const document of result.documents) {
      await refreshDocument(context, sync, input.runId, input.page, document, session, assertOwned);
    }

    await assertOwned();
    await requireSourceSyncAccess(context, sync, true);

    if (result.complete) {
      await repository.complete(sync.id, input.runId, input.page);
    } else if (await repository.checkpoint(sync.id, input.runId, input.page, result.checkpoint)) {
      const current = await repository.get(sync.id);

      if (current) {
        await enqueueSyncPage(context, current);
      }
    }
  } catch (error) {
    await repository.fail(
      sync.id,
      input.runId,
      input.page,
      "Could not complete the scan. Check source access and the connection, then retry.",
    );
    throw error;
  }
}
