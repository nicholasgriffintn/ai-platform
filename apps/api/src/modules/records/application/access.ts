import { authorise } from "@ngriffin_uk/polychat-library-policy";
import {
  nativeRecordDefinitionSchema,
  type NativeRecordTable,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireOutputRecordAccess } from "~/modules/outputs/application/access";
import { formatOutput } from "~/modules/outputs/application/format";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

export async function requireNativeRecordTable(context: ServiceContext, tableId: string) {
  const user = context.requireUser();
  const stored = await context.repositories.outputs.getCurrentOutput(tableId);

  if (!stored || stored.kind !== "records") {
    throw new AssistantError("Record table not found", ErrorType.NOT_FOUND, 404);
  }

  await requireOutputRecordAccess(context, user.id, stored);
  const output = formatOutput(stored);
  const definition = nativeRecordDefinitionSchema.parse(output.content);
  const role = output.projectId ? (await requireProjectAccess(context, output.projectId)).role : "";
  const facts = {
    actorId: String(user.id),
    tableOwnerId: String(output.createdByUserId),
    rowOwnerId: "",
    scope: output.projectId ? "project" : "personal",
    member: Boolean(output.projectId),
    role,
    visibility: definition.visibility,
    editing: definition.editing,
    active: output.status === "ready",
  };
  const canManage = authorise("resource.write", {
    actorId: facts.actorId,
    ownerId: facts.tableOwnerId,
    scope: facts.scope,
    member: facts.member,
    role,
  }).allowed;
  const canReadAllRows = authorise("records.read", facts).allowed;
  const permissions = {
    actorUserId: user.id,
    canManage,
    canCreate: authorise("records.write", { ...facts, rowOwnerId: facts.actorId }).allowed,
    canEditAllRows: authorise("records.write", facts).allowed,
  };
  const table: NativeRecordTable = { output, definition, permissions };

  const fence = {
    tableRevision: output.revision,
    actorUserId: user.id,
    projectId: output.projectId,
    role,
  };

  return { table, facts, fence, visibleOwnerId: canReadAllRows ? undefined : user.id };
}

export function requireNativeRecordWrite(
  access: Awaited<ReturnType<typeof requireNativeRecordTable>>,
  rowOwnerId: number,
) {
  if (!authorise("records.write", { ...access.facts, rowOwnerId: String(rowOwnerId) }).allowed) {
    throw new AssistantError("You cannot edit this record", ErrorType.FORBIDDEN, 403);
  }
}
