import {
  findProjectFlowNode,
  createNativeRecordSchema,
  type NativeRecordValues,
  type ProjectTask,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireNativeRecordTable } from "~/modules/records/application/access";
import { createNativeRecord, getNativeRecord } from "~/modules/records/application/records";

import { resolveProjectFlowValue } from "../domain/flow-machine";
import type { FlowExecutionOwner } from "../infrastructure/ProjectFlowRepository";
import { completeDispatchedFlowWait, driveProjectFlow } from "./flow-execution";

export async function runProjectFlowFunction(
  context: ServiceContext,
  task: ProjectTask,
  owner: FlowExecutionOwner,
) {
  const node = findProjectFlowNode(task.flowSnapshot, task.flowExecution.nodeId);

  if (!node || node.type !== "function") {
    throw new AssistantError("Function node not found", ErrorType.CONFLICT_ERROR, 409);
  }

  const operation = node.operation;
  let values: NativeRecordValues = {};

  if (operation.kind === "set_values") {
    values = Object.fromEntries(
      Object.entries(operation.values).map(([key, binding]) => [
        key,
        resolveProjectFlowValue(binding, task.flowExecution.values),
      ]),
    );
  } else {
    const access = await requireNativeRecordTable(context, operation.tableId);

    if (
      access.table.output.projectId !== task.projectId ||
      access.table.definition.visibility !== "shared"
    ) {
      throw new AssistantError(
        "Flow records must be shared in this project",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    if (operation.kind === "read_record") {
      const recordId = resolveProjectFlowValue(operation.recordId, task.flowExecution.values);

      if (typeof recordId !== "string") {
        throw new AssistantError("Enter a record ID", ErrorType.PARAMS_ERROR, 400);
      }

      const record = await getNativeRecord(context, operation.tableId, recordId);

      for (const [variable, columnId] of Object.entries(operation.saveFields)) {
        if (!access.table.definition.columns.some((column) => column.id === columnId)) {
          throw new AssistantError(
            "The requested column no longer exists",
            ErrorType.CONFLICT_ERROR,
            409,
          );
        }

        values[variable] = record.values[columnId] ?? null;
      }
    } else {
      const wait = task.flowExecution.waitId
        ? await context.repositories.projectFlows.getWait(task.flowExecution.waitId)
        : null;

      if (!wait || wait.executionId !== owner.dispatchTaskId) {
        throw new AssistantError("The function wait changed", ErrorType.CONFLICT_ERROR, 409);
      }

      const input = createNativeRecordSchema.parse({
        requestId: wait.payload.requestId,
        tableRevision: wait.payload.tableRevision,
        values: Object.fromEntries(
          Object.entries(operation.values).map(([key, binding]) => [
            key,
            resolveProjectFlowValue(binding, task.flowExecution.values),
          ]),
        ),
      });
      const record = await createNativeRecord(context, operation.tableId, input, undefined, {
        ...owner,
        taskId: task.id,
        flowRevision: task.flowRevision,
        waitId: wait.id,
      });

      if (operation.outputIdKey) {
        values[operation.outputIdKey] = record.id;
      }
    }
  }

  const advanced = await completeDispatchedFlowWait({ context, task, values, owner });

  return driveProjectFlow(context, advanced);
}
