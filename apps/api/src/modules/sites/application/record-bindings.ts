import {
  nativeRecordQuerySchema,
  type SiteRecordOperation,
  type SiteRecordOperationResponse,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireOutputRecordAccess } from "~/modules/outputs/application/access";
import { requireNativeRecordTable } from "~/modules/records/application/access";
import {
  createNativeRecord,
  updateNativeRecord,
  deleteNativeRecord,
} from "~/modules/records/application/records";
import { requireRecordViewBindings } from "~/modules/records/application/views";

import { mapSiteRecord } from "./records";

export async function executeSiteRecordOperation(
  context: ServiceContext,
  siteId: string,
  operation: SiteRecordOperation,
): Promise<SiteRecordOperationResponse> {
  const actor = context.requireUser();
  const output = await context.repositories.outputs.getCurrentOutput(siteId);

  if (!output || output.kind !== "site") {
    throw new AssistantError("Site not found", ErrorType.NOT_FOUND, 404);
  }

  await requireOutputRecordAccess(context, actor.id, output);
  if (output.revision !== operation.siteRevision) {
    throw new AssistantError(
      "The Site has changed. Refresh before using its records.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const site = mapSiteRecord(output);
  const view = site?.project.recordViews?.find((item) => item.id === operation.viewId);

  if (!view) {
    throw new AssistantError("Record view not found", ErrorType.NOT_FOUND, 404);
  }

  await requireRecordViewBindings(context, output.project_id, [view]);
  const binding = { outputId: output.id, revision: output.revision };

  if (operation.operation === "query") {
    const access = await requireNativeRecordTable(context, view.tableId);
    const result = await context.repositories.nativeRecords.list(
      view.tableId,
      access.table.definition,
      nativeRecordQuerySchema.parse({
        ...view.query,
        offset: operation.offset,
        limit: operation.limit,
      }),
      { ...access.fence, binding },
      access.visibleOwnerId,
    );

    return { operation: "query", view, table: access.table, result };
  }

  if (!view.editable) {
    throw new AssistantError("This Site view is read-only", ErrorType.FORBIDDEN, 403);
  }

  switch (operation.operation) {
    case "create":
      return {
        operation: "create",
        record: await createNativeRecord(context, view.tableId, operation.input, binding),
      };
    case "update":
      return {
        operation: "update",
        record: await updateNativeRecord(
          context,
          view.tableId,
          operation.recordId,
          operation.input,
          binding,
        ),
      };
    case "delete":
      return {
        operation: "delete",
        record: await deleteNativeRecord(
          context,
          view.tableId,
          operation.recordId,
          operation.input,
          binding,
        ),
      };
  }
}
