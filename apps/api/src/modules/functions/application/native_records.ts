import type {
  ReadNativeRecordsInput,
  WriteNativeRecordsInput,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { listOutputs } from "~/modules/outputs/application";
import { requireNativeRecordTable } from "~/modules/records/application/access";
import {
  createNativeRecord,
  getNativeRecord,
  listNativeRecords,
  listNativeRecordChanges,
  updateNativeRecord,
  deleteNativeRecord,
} from "~/modules/records/application/records";
import {
  createNativeRecordTable,
  getNativeRecordTable,
  updateNativeRecordTable,
} from "~/modules/records/application/tables";
import type { IRequest } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";

import {
  read_records as readDescriptor,
  write_records as writeDescriptor,
} from "./definitions/native_records";
import { resolveRequestProjectId } from "./request-context";

async function requireRecordToolScope(
  context: ServiceContext,
  request: IRequest,
  input: ReadNativeRecordsInput | WriteNativeRecordsInput,
) {
  const requestProjectId = resolveRequestProjectId(request);

  if ("tableId" in input) {
    const { table } = await requireNativeRecordTable(context, input.tableId);

    if (table.output.projectId !== requestProjectId) {
      throw new AssistantError(
        "The table is outside this conversation's project",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    return table.output.projectId ?? undefined;
  }

  if (requestProjectId && input.projectId && input.projectId !== requestProjectId) {
    throw new AssistantError(
      "The table is outside this conversation's project",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  return requestProjectId ?? input.projectId;
}

export const read_records: ApiToolDefinition = {
  ...readDescriptor,
  execute: async (input: ReadNativeRecordsInput, toolContext) => {
    const { context, user } = toolContext.request;

    if (!context || !user) {
      throw new AssistantError(
        "Reading records needs a signed-in user",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    const projectId = await requireRecordToolScope(context, toolContext.request, input);
    let data: unknown;

    switch (input.action) {
      case "list_tables":
        data = await listOutputs(context, user.id, {
          projectId,
          kind: "records",
          offset: input.offset,
          limit: 100,
        });
        break;
      case "get_table":
        data = await getNativeRecordTable(context, input.tableId);
        break;
      case "query":
        data = await listNativeRecords(context, input.tableId, input.query);
        break;
      case "get_record":
        data = await getNativeRecord(context, input.tableId, input.recordId);
        break;
      case "changes":
        data = await listNativeRecordChanges(context, input.tableId, input.after);
        break;
    }

    return { status: "success", name: readDescriptor.name, content: JSON.stringify(data), data };
  },
};

export const write_records: ApiToolDefinition = {
  ...writeDescriptor,
  execute: async (input: WriteNativeRecordsInput, toolContext) => {
    const { context, user } = toolContext.request;

    if (!context || !user) {
      throw new AssistantError(
        "Writing records needs a signed-in user",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    const projectId = await requireRecordToolScope(context, toolContext.request, input);
    let data: unknown;

    switch (input.action) {
      case "create_table":
        data = await createNativeRecordTable(context, {
          title: input.title,
          definition: input.definition,
          projectId,
        });
        break;
      case "update_table":
        data = await updateNativeRecordTable(context, input.tableId, {
          title: input.title,
          definition: input.definition,
          expectedRevision: input.expectedRevision,
        });
        break;
      case "create_record":
        data = await createNativeRecord(context, input.tableId, {
          requestId: input.requestId,
          tableRevision: input.tableRevision,
          values: input.values,
        });
        break;
      case "update_record":
        data = await updateNativeRecord(context, input.tableId, input.recordId, {
          tableRevision: input.tableRevision,
          expectedRevision: input.expectedRevision,
          values: input.values,
        });
        break;
      case "delete_record":
        data = await deleteNativeRecord(context, input.tableId, input.recordId, {
          tableRevision: input.tableRevision,
          expectedRevision: input.expectedRevision,
        });
        break;
    }

    return { status: "success", name: writeDescriptor.name, content: JSON.stringify(data), data };
  },
};
