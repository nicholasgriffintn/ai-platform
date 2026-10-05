import {
  validateNativeRecordValues,
  type CreateNativeRecordInput,
  type UpdateNativeRecordInput,
  type DeleteNativeRecordInput,
  type NativeRecordQuery,
  type NativeRecordDefinition,
} from "@ngriffin_uk/polychat-schemas";
import { canonicalJson } from "@ngriffin_uk/polychat-utility-core";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import type { NativeRecordAccessFence } from "../infrastructure/NativeRecordRepository";
import { requireNativeRecordTable, requireNativeRecordWrite } from "./access";
import { nativeRecordExecutionOrigin } from "./execution";

function validateValues(definition: NativeRecordDefinition, values: unknown) {
  try {
    return validateNativeRecordValues(definition, values);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AssistantError(
        error.issues[0]?.message ?? "Invalid record values",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    throw error;
  }
}

export async function listNativeRecords(
  context: ServiceContext,
  tableId: string,
  query: NativeRecordQuery,
) {
  const access = await requireNativeRecordTable(context, tableId);

  return context.repositories.nativeRecords.list(
    tableId,
    access.table.definition,
    query,
    access.fence,
    access.visibleOwnerId,
  );
}

export async function getNativeRecord(context: ServiceContext, tableId: string, recordId: string) {
  const access = await requireNativeRecordTable(context, tableId);
  const found = await context.repositories.nativeRecords.get(
    tableId,
    recordId,
    access.visibleOwnerId,
    access.fence,
  );

  if (!found || found.record.deletedAt) {
    throw new AssistantError("Record not found", ErrorType.NOT_FOUND, 404);
  }

  return found.record;
}

export async function listNativeRecordChanges(
  context: ServiceContext,
  tableId: string,
  after: number,
) {
  const access = await requireNativeRecordTable(context, tableId);

  return context.repositories.nativeRecords.changes(
    tableId,
    after,
    access.fence,
    access.visibleOwnerId,
  );
}

export async function createNativeRecord(
  context: ServiceContext,
  tableId: string,
  input: CreateNativeRecordInput,
  binding?: NativeRecordAccessFence["binding"],
  flow?: NativeRecordAccessFence["flow"],
) {
  const access = await requireNativeRecordTable(context, tableId);
  const fence: NativeRecordAccessFence = {
    ...access.fence,
    binding,
    flow: flow ?? context.projectTaskExecution,
    originTaskId: await nativeRecordExecutionOrigin(context, flow?.taskId),
  };
  const userId = context.requireUser().id;
  const creationHash = await sha256Hex(canonicalJson({ userId, tableId, input }));
  const retry = await context.repositories.nativeRecords.get(
    tableId,
    input.requestId,
    userId,
    fence,
  );

  if (retry) {
    if (retry.creationHash !== creationHash) {
      throw new AssistantError(
        "The request ID already belongs to different record values",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    return retry.record;
  }

  requireNativeRecordWrite(access, userId);
  if (access.table.output.revision !== input.tableRevision) {
    throw new AssistantError(
      "The table has changed. Refresh its columns first.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const values = validateValues(access.table.definition, input.values);

  try {
    return await context.repositories.nativeRecords.create(
      {
        id: input.requestId,
        tableId,
        userId,
        tableRevision: input.tableRevision,
        values,
        creationHash,
      },
      fence,
    );
  } catch (error) {
    const concurrent = await context.repositories.nativeRecords.get(
      tableId,
      input.requestId,
      userId,
      fence,
    );

    if (concurrent?.creationHash === creationHash) {
      return concurrent.record;
    }

    if (concurrent) {
      throw new AssistantError(
        "The request ID already belongs to different record values",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    throw error;
  }
}

export async function updateNativeRecord(
  context: ServiceContext,
  tableId: string,
  recordId: string,
  input: UpdateNativeRecordInput,
  binding?: NativeRecordAccessFence["binding"],
) {
  const access = await requireNativeRecordTable(context, tableId);
  const fence: NativeRecordAccessFence = {
    ...access.fence,
    binding,
    flow: context.projectTaskExecution,
    originTaskId: await nativeRecordExecutionOrigin(context),
  };
  const found = await context.repositories.nativeRecords.get(
    tableId,
    recordId,
    access.visibleOwnerId,
    fence,
  );

  if (!found || found.record.deletedAt) {
    throw new AssistantError("Record not found", ErrorType.NOT_FOUND, 404);
  }

  requireNativeRecordWrite(access, found.record.createdByUserId);
  if (access.table.output.revision !== input.tableRevision) {
    throw new AssistantError(
      "The table has changed. Refresh its columns first.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const values = validateValues(access.table.definition, input.values);

  return context.repositories.nativeRecords.update(
    {
      tableId,
      recordId,
      userId: context.requireUser().id,
      tableRevision: input.tableRevision,
      expectedRevision: input.expectedRevision,
      values,
    },
    fence,
  );
}

export async function deleteNativeRecord(
  context: ServiceContext,
  tableId: string,
  recordId: string,
  input: DeleteNativeRecordInput,
  binding?: NativeRecordAccessFence["binding"],
) {
  const access = await requireNativeRecordTable(context, tableId);
  const fence: NativeRecordAccessFence = {
    ...access.fence,
    binding,
    flow: context.projectTaskExecution,
    originTaskId: await nativeRecordExecutionOrigin(context),
  };
  const found = await context.repositories.nativeRecords.get(
    tableId,
    recordId,
    access.visibleOwnerId,
    fence,
  );

  if (!found || found.record.deletedAt) {
    throw new AssistantError("Record not found", ErrorType.NOT_FOUND, 404);
  }

  requireNativeRecordWrite(access, found.record.createdByUserId);
  if (access.table.output.revision !== input.tableRevision) {
    throw new AssistantError(
      "The table has changed. Refresh its columns first.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return context.repositories.nativeRecords.update(
    {
      tableId,
      recordId,
      userId: context.requireUser().id,
      tableRevision: input.tableRevision,
      expectedRevision: input.expectedRevision,
      values: found.record.values,
      deleted: true,
    },
    fence,
  );
}
