import {
  NATIVE_RECORDS_CAPABILITY_ID,
  NATIVE_RECORDS_OUTPUT_KIND,
  type CreateNativeRecordTableInput,
  type UpdateNativeRecordTableInput,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { createOutput, updateOutput } from "~/modules/outputs/application";

import { requireNativeRecordTable } from "./access";

export async function createNativeRecordTable(
  context: ServiceContext,
  input: CreateNativeRecordTableInput,
) {
  const user = context.requireUser();
  const output = await createOutput(context, user.id, {
    title: input.title,
    projectId: input.projectId,
    capabilityId: NATIVE_RECORDS_CAPABILITY_ID,
    kind: NATIVE_RECORDS_OUTPUT_KIND,
    status: "ready",
    sensitivity: input.projectId ? "internal" : "personal",
    content: input.definition,
  });

  return (await requireNativeRecordTable(context, output.id)).table;
}

export async function getNativeRecordTable(context: ServiceContext, tableId: string) {
  return (await requireNativeRecordTable(context, tableId)).table;
}

export async function updateNativeRecordTable(
  context: ServiceContext,
  tableId: string,
  input: UpdateNativeRecordTableInput,
) {
  const { table } = await requireNativeRecordTable(context, tableId);

  if (!table.permissions.canManage) {
    throw new AssistantError(
      "Only the table creator or a project admin can change its columns",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  await updateOutput(context, context.requireUser().id, tableId, {
    expectedRevision: input.expectedRevision,
    title: input.title,
    content: input.definition,
  });

  return getNativeRecordTable(context, tableId);
}
