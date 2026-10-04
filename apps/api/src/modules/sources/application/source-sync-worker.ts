import {
  createKnowledgeProxyReader,
  getDriveKnowledgePermissions,
  listDriveKnowledgePage,
  readDriveKnowledgeContent,
  validateDriveKnowledgeVersion,
} from "@ngriffin_uk/polychat-ai-integrations";
import {
  SOURCE_SYNC_TASK_TYPE,
  sourceSyncCheckpointSchema,
  type DriveKnowledgeFile,
} from "@ngriffin_uk/polychat-schemas";
import { generatePrefixedId, safeParseJson } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  SourceSyncRepository,
  type SourceSyncRecord,
} from "~/modules/sources/infrastructure/SourceSyncRepository";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { IEnv } from "~/types";

import { requireSourceSyncAccess, requireSourceSyncAccount } from "./source-sync-access";

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
    if (!sync.run_id) {
      await repository.begin(sync.id, generatePrefixedId("scan_"), {
        folders: [sync.root_id],
        folderIndex: 0,
        pageToken: null,
      });
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
  file: DriveKnowledgeFile,
  accountId: string,
  assertOwned: () => Promise<void>,
): Promise<void> {
  const repository = new SourceSyncRepository(context.env);
  const read = createKnowledgeProxyReader(context.env, accountId);

  await assertOwned();
  await requireSourceSyncAccess(context, sync, true);
  await repository.invalidatePermissions(sync.id, file.id, runId, page);

  try {
    const permissions = await getDriveKnowledgePermissions(read, file.id);
    const previous = await repository.getSyncedSource(sync.id, file.id);

    if (previous?.upstream_version === file.version && previous.content) {
      await validateDriveKnowledgeVersion(read, file);
    }

    const content =
      previous?.upstream_version === file.version && previous.content
        ? previous.content
        : await readDriveKnowledgeContent(read, file);

    await assertOwned();
    await requireSourceSyncAccess(context, sync, true);
    await repository.storeDocument({
      sync,
      runId,
      page,
      upstreamId: file.id,
      version: file.version,
      title: file.name,
      content,
      permissions,
      sourceUrl: `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`,
    });
  } catch (error) {
    if (
      error instanceof AssistantError &&
      [401, 403, 404, 413, 422].includes(error.statusCode ?? 0)
    ) {
      await assertOwned();
      await repository.archiveDocument(sync.id, file.id, runId, page);

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
    const account = await requireSourceSyncAccount(context, sync.connection_id);
    const checkpoint = sourceSyncCheckpointSchema.parse(safeParseJson(sync.checkpoint));
    const result = await listDriveKnowledgePage(
      createKnowledgeProxyReader(context.env, account.id),
      checkpoint,
    );

    for (const file of result.files) {
      await refreshDocument(context, sync, input.runId, input.page, file, account.id, assertOwned);
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
      "Could not complete the scan. Check folder access and the connected account, then retry.",
    );
    throw error;
  }
}
