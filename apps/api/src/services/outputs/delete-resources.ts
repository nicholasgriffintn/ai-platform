import type { ServiceContext } from "~/lib/context/serviceContext";
import {
  isOutputDeletionPending,
  parseOutputContent,
  withOutputDeletionPending,
} from "~/lib/outputs/deletion";
import {
  cleanupOcrBatchProviderResources,
  getOcrBatchProviderCleanupState,
  MistralOcrBatchClient,
  withOcrBatchProviderCleanup,
  withoutOcrBatchProviderCleanup,
} from "~/lib/providers/capabilities/ocr/batch/MistralOcrBatchClient";
import { StorageService } from "~/lib/storage";
import type { OutputRecord } from "~/repositories/OutputRepository";
import { AssistantError, ErrorType } from "~/utils/errors";

import { requireOutputRecordAccess } from "./access";

const ACTIVE_BATCH_STATUSES = new Set(["QUEUED", "RUNNING", "CANCELLATION_REQUESTED"]);

async function getBatchOwner(context: ServiceContext, output: OutputRecord) {
  const owner = await context.repositories.users.getUserById(output.created_by_user_id);

  if (!owner) {
    throw new AssistantError("OCR batch owner no longer exists", ErrorType.INTERNAL_ERROR);
  }

  return owner;
}

async function prepareOcrBatchDeletion(
  context: ServiceContext,
  actorUserId: number,
  initialOutput: OutputRecord,
): Promise<OutputRecord> {
  let output = initialOutput;
  let content = parseOutputContent(output.content);
  let cleanup = getOcrBatchProviderCleanupState(content);

  if (output.status === "pending" && !cleanup) {
    if (content.batchStatus === "persisting") {
      throw new AssistantError(
        "OCR batch completion is being persisted; retry deletion shortly",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    const providerJobId = content.providerJobId;

    if (typeof providerJobId !== "string" || !providerJobId) {
      throw new AssistantError(
        "OCR batch provider job is unavailable",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    if (!isOutputDeletionPending(output)) {
      output = await context.repositories.outputs.updateOutput(output.id, {
        status: "pending",
        expectedRevision: output.revision,
        updatedByUserId: actorUserId,
        content: withOutputDeletionPending({ ...content, batchStatus: "deletion_pending" }),
      });
      content = parseOutputContent(output.content);
    }

    const owner = await getBatchOwner(context, output);
    const batchClient = new MistralOcrBatchClient();
    const job = await batchClient.cancel({ env: context.env, user: owner, jobId: providerJobId });

    if (ACTIVE_BATCH_STATUSES.has(job.status)) {
      throw new AssistantError(
        "OCR batch cancellation is still pending; retry deletion shortly",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    output = await context.repositories.outputs.updateOutput(output.id, {
      status: "failed",
      expectedRevision: output.revision,
      updatedByUserId: actorUserId,
      content: withOutputDeletionPending(withOcrBatchProviderCleanup(content, job)),
    });
    content = parseOutputContent(output.content);
    cleanup = getOcrBatchProviderCleanupState(content);
  }

  if (!cleanup) {
    return output;
  }

  const owner = await getBatchOwner(context, output);
  const batchClient = new MistralOcrBatchClient();

  await cleanupOcrBatchProviderResources(
    batchClient,
    { env: context.env, user: owner },
    {
      id: cleanup.jobId,
      output_file: cleanup.outputFileId,
      error_file: cleanup.errorFileId,
    },
  );

  return context.repositories.outputs.updateOutput(output.id, {
    status: "failed",
    expectedRevision: output.revision,
    updatedByUserId: actorUserId,
    content: withOutputDeletionPending(withoutOcrBatchProviderCleanup(content)),
  });
}

async function tombstoneOutput(
  context: ServiceContext,
  actorUserId: number,
  output: OutputRecord,
): Promise<OutputRecord> {
  if (isOutputDeletionPending(output)) {
    return output;
  }

  return context.repositories.outputs.updateOutput(output.id, {
    status: "failed",
    expectedRevision: output.revision,
    updatedByUserId: actorUserId,
    content: withOutputDeletionPending(parseOutputContent(output.content)),
  });
}

async function prepareOcrBatchResultDeletion(
  context: ServiceContext,
  actorUserId: number,
  result: OutputRecord,
): Promise<void> {
  if (!result.parent_output_id) {
    return;
  }

  const parent = await context.repositories.outputs.getOutputIncludingDeleting(
    result.parent_output_id,
  );

  if (!parent || parent.capability_id !== "ocr" || parent.kind !== "ocr_batch") {
    return;
  }

  await requireOutputRecordAccess(context, actorUserId, parent, true);
  const parentContent = parseOutputContent(parent.content);

  if (parent.status === "pending" || parentContent.batchStatus === "persisting") {
    throw new AssistantError(
      "OCR batch results cannot be deleted while completion is being persisted",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (parentContent.resultOutputId !== result.id) {
    return;
  }

  const { resultOutputId: _resultOutputId, ...nextContent } = parentContent;
  const project = parent.project_id
    ? await context.repositories.workspaces.getProject(parent.project_id)
    : null;

  if (parent.project_id && !project) {
    throw new AssistantError("Project not found", ErrorType.NOT_FOUND, 404);
  }

  await context.repositories.outputs.updateOutput(
    parent.id,
    {
      status: parent.status,
      expectedRevision: parent.revision,
      updatedByUserId: actorUserId,
      content: nextContent,
    },
    project
      ? {
          workspaceId: project.workspace_id,
          actorUserId,
          action: "output.updated",
          outputId: parent.id,
          metadata: { revision: parent.revision + 1 },
        }
      : undefined,
  );
}

export async function deleteOutputResources(
  context: ServiceContext,
  actorUserId: number,
  outputId: string,
): Promise<void> {
  let root = await context.repositories.outputs.getOutputIncludingDeleting(outputId);

  if (!root) {
    throw new AssistantError("Output not found", ErrorType.NOT_FOUND, 404);
  }

  await requireOutputRecordAccess(context, actorUserId, root, true);

  if (root.capability_id === "ocr" && root.kind === "ocr_batch_result") {
    await prepareOcrBatchResultDeletion(context, actorUserId, root);
  }

  if (root.capability_id === "ocr" && root.kind === "ocr_batch") {
    root = await prepareOcrBatchDeletion(context, actorUserId, root);
  }

  const descendants = await context.repositories.outputs.listOutputDescendants(outputId);

  for (const descendant of descendants) {
    // Descendants may have different project creators, so a parent cannot bypass mutation rules.
    // eslint-disable-next-line no-await-in-loop
    await requireOutputRecordAccess(context, actorUserId, descendant, true);
  }

  const tombstonedDescendants: OutputRecord[] = [];

  for (const descendant of descendants) {
    // Persist every retry handle before removing any external object.
    // eslint-disable-next-line no-await-in-loop
    tombstonedDescendants.push(await tombstoneOutput(context, actorUserId, descendant));
  }

  root = await tombstoneOutput(context, actorUserId, root);
  // The API target does not include ES2023 Array#toReversed yet.
  // eslint-disable-next-line unicorn/no-array-reverse
  const records = [...tombstonedDescendants].reverse().concat(root);
  const storageKeys = records.flatMap((record) => (record.storage_key ? [record.storage_key] : []));

  if (storageKeys.length > 0) {
    const storage = StorageService.forPrivateAssets(context);

    for (const storageKey of storageKeys) {
      // Tombstones retain each key until its idempotent deletion succeeds.
      // eslint-disable-next-line no-await-in-loop
      await storage.deleteObject(storageKey);
    }
  }

  const project = root.project_id
    ? await context.repositories.workspaces.getProject(root.project_id)
    : null;

  if (root.project_id && !project) {
    throw new AssistantError("Project not found", ErrorType.NOT_FOUND, 404);
  }

  const outputIds = records.map((record) => record.id);

  if (project) {
    await context.repositories.outputs.deleteOutputs(outputIds, {
      workspaceId: project.workspace_id,
      actorUserId,
      action: "output.deleted",
      outputId,
      metadata: {},
    });
  } else {
    await context.repositories.outputs.deleteOutputs(outputIds);
  }
}
