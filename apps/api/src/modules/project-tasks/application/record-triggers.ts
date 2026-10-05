import type { ProjectFlow, NativeRecordValues } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  requireNativeRecordTable,
  requireNativeRecordWrite,
} from "~/modules/records/application/access";
import { listNativeRecordChanges } from "~/modules/records/application/records";
import { compileNativeRecordQuery } from "~/modules/records/infrastructure/query";
import { requireProjectAccess } from "~/modules/workspaces/application/access";
import type { IEnv } from "~/types";

import { initialProjectFlowExecution } from "../domain/flow-machine";
import { driveProjectFlow, reloadFlowTask } from "./flow-execution";

export async function validateFlowRecordBindings(
  context: ServiceContext,
  projectId: string,
  flow: ProjectFlow,
) {
  const { project } = await requireProjectAccess(context, projectId);

  for (const node of flow.nodes) {
    if (
      node.type === "human_wait" &&
      node.assigneeUserId &&
      !(await context.repositories.workspaces.getMembership(
        project.workspace_id,
        node.assigneeUserId,
      ))
    ) {
      throw new AssistantError(
        "Flow reviewers must belong to this workspace",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    if (node.type !== "function" || node.operation.kind === "set_values") {
      continue;
    }

    const access = await requireNativeRecordTable(context, node.operation.tableId);

    if (
      access.table.output.projectId !== projectId ||
      access.table.definition.visibility !== "shared"
    ) {
      throw new AssistantError(
        "Flow tables must contain shared records in this project",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    if (node.operation.kind === "create_record") {
      requireNativeRecordWrite(access, context.requireUser().id);
    }

    const fields =
      node.operation.kind === "read_record"
        ? Object.values(node.operation.saveFields)
        : Object.keys(node.operation.values);

    if (fields.some((id) => !access.table.definition.columns.some((column) => column.id === id))) {
      throw new AssistantError(
        "A flow function references an unknown column",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  }

  for (const trigger of flow.recordTriggers) {
    const access = await requireNativeRecordTable(context, trigger.tableId);

    if (
      access.table.output.projectId !== projectId ||
      access.table.definition.visibility !== "shared"
    ) {
      throw new AssistantError(
        "Record triggers require a shared table in this project",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    compileNativeRecordQuery(access.table.definition, {
      filters: trigger.filters,
      limit: 1,
      offset: 0,
    });
    if (
      Object.values(trigger.saveFields).some(
        (id) => !access.table.definition.columns.some((column) => column.id === id),
      )
    ) {
      throw new AssistantError(
        "A record trigger references an unknown column",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  }
}

export async function scheduleRecordTriggeredTasks(env: IEnv): Promise<void> {
  const base = createServiceContext({ env });

  for (const initial of await base.repositories.projectRecordTriggers.active()) {
    let trigger = initial;

    try {
      const user = await base.repositories.users.getUserById(trigger.runnerUserId);

      if (!user) {
        throw new AssistantError(
          "The trigger owner is no longer available",
          ErrorType.FORBIDDEN,
          403,
        );
      }

      const context = createServiceContext({ env, user });
      const { project } = await requireProjectAccess(context, trigger.projectId);
      const access = await requireNativeRecordTable(context, trigger.tableId);

      if (
        access.table.output.projectId !== trigger.projectId ||
        access.table.definition.visibility !== "shared"
      ) {
        throw new AssistantError(
          "The trigger's shared table is no longer available",
          ErrorType.FORBIDDEN,
          403,
        );
      }

      const compiled = compileNativeRecordQuery(access.table.definition, {
        filters: trigger.configuration.filters,
        limit: 1,
        offset: 0,
      });
      const journal = await listNativeRecordChanges(context, trigger.tableId, trigger.cursor);

      for (const change of journal.changes.slice(0, 20)) {
        const operationMatches =
          change.triggerEligible && trigger.configuration.operations.includes(change.operation);
        const matched =
          operationMatches &&
          Boolean(
            await env.DB.prepare(
              `SELECT 1 AS matched FROM (SELECT ? AS values_json) WHERE 1 = 1${compiled.where}`,
            )
              .bind(JSON.stringify(change.record.values), ...compiled.parameters)
              .first(),
          );
        const taskId = `record:${trigger.id}:${change.sequence}`;
        const statements = [
          context.repositories.projectRecordTriggers.prepareAdvance(
            trigger,
            change,
            access.table.output.revision,
          ),
        ];

        if (matched) {
          const values: NativeRecordValues = {
            record_id: change.recordId,
            record_operation: change.operation,
          };

          for (const [variable, columnId] of Object.entries(trigger.configuration.saveFields)) {
            if (!access.table.definition.columns.some((column) => column.id === columnId)) {
              throw new AssistantError(
                "A trigger column no longer exists",
                ErrorType.CONFLICT_ERROR,
                409,
              );
            }

            values[variable] = change.record.values[columnId] ?? null;
          }

          statements.push(
            context.repositories.projectTasks.prepareTriggeredTask({
              id: taskId,
              projectId: project.id,
              workspaceId: project.workspace_id,
              objective: trigger.configuration.objective,
              createdByUserId: user.id,
              flowSnapshot: trigger.flow,
              flowExecution: {
                ...initialProjectFlowExecution(trigger.flow, trigger.configuration.entryNodeId),
                values,
              },
            }),
          );
          statements.push(
            env.DB.prepare(`INSERT INTO workspace_audit_record
            (id, workspace_id, actor_user_id, action, target_type, target_id, metadata)
            SELECT ?, ?, ?, 'project.task.record_triggered', 'project_task', ?, ? WHERE changes() = 1`).bind(
              generateId(),
              project.workspace_id,
              user.id,
              taskId,
              JSON.stringify({
                triggerId: trigger.id,
                tableId: trigger.tableId,
                sequence: change.sequence,
              }),
            ),
          );
        }

        const result = await env.DB.batch(statements);

        if (result[0]?.meta.changes !== 1) {
          break;
        }

        trigger = { ...trigger, cursor: change.sequence };
        if (matched) {
          try {
            await driveProjectFlow(context, await reloadFlowTask(context, taskId));
          } catch (error) {
            context
              .getLogger({ prefix: "record-triggers" })
              .warn("Triggered task is awaiting continuation", {
                taskId,
                error: getErrorMessage(error),
              });
          }
        }
      }
    } catch (error) {
      await base.repositories.projectRecordTriggers.pause(trigger, getErrorMessage(error));
    }
  }
}
