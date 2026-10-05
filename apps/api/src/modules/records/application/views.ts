import { nativeRecordQuerySchema, type NativeRecordView } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { compileNativeRecordQuery } from "../infrastructure/query";
import { requireNativeRecordTable } from "./access";

export async function requireRecordViewBindings(
  context: ServiceContext,
  projectId: string | null,
  views: NativeRecordView[],
) {
  const identifiers = new Set<string>();

  for (const view of views) {
    if (identifiers.has(view.id)) {
      throw new AssistantError("Record view IDs must be unique", ErrorType.PARAMS_ERROR, 400);
    }

    identifiers.add(view.id);
    const { table } = await requireNativeRecordTable(context, view.tableId);

    if (table.output.projectId !== projectId) {
      throw new AssistantError(
        "A record view must use a table from the same scope",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    const columns = table.definition.columns;

    if (view.columns?.some((id) => !columns.some((column) => column.id === id))) {
      throw new AssistantError("A view references an unknown column", ErrorType.PARAMS_ERROR, 400);
    }

    if (
      view.presentation === "board" &&
      !columns.some((column) => column.id === view.groupColumnId && column.type === "select")
    ) {
      throw new AssistantError(
        "A board must group by a choice column",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    if (
      view.presentation === "checklist" &&
      !columns.some((column) => column.id === view.checkedColumnId && column.type === "boolean")
    ) {
      throw new AssistantError(
        "A checklist requires a checkbox column",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    compileNativeRecordQuery(table.definition, nativeRecordQuerySchema.parse(view.query));
  }
}
