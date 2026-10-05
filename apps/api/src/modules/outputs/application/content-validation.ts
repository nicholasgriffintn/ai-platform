import {
  documentOutputContentSchema,
  nativeRecordDefinitionSchema,
  validateNativeRecordValues,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireRecordViewBindings } from "~/modules/records/application/views";

export async function validateOutputBindings(
  context: ServiceContext,
  kind: string,
  projectId: string | null,
  content: Record<string, unknown>,
) {
  if (kind === "document") {
    await requireRecordViewBindings(
      context,
      projectId,
      documentOutputContentSchema.parse(content).recordViews,
    );
  }
}

export function validateOutputContent(kind: string, content: Record<string, unknown>) {
  try {
    if (kind === "document") {
      return documentOutputContentSchema.parse(content);
    }

    if (kind === "records") {
      return nativeRecordDefinitionSchema.parse(content);
    }

    return content;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AssistantError(
        error.issues[0]?.message ?? "Invalid output content",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    throw error;
  }
}

export async function validateRecordDefinitionUpdate(
  context: ServiceContext,
  tableId: string,
  content: Record<string, unknown>,
) {
  const definition = nativeRecordDefinitionSchema.parse(content);
  const cursor = await context.repositories.nativeRecords.cursor(tableId);
  let offset = 0;

  for (;;) {
    const rows = await context.repositories.nativeRecords.activeValues(tableId, offset);

    try {
      for (const row of rows) {
        validateNativeRecordValues(definition, row);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AssistantError(
          "These columns would invalidate existing records. Update the affected rows first.",
          ErrorType.CONFLICT_ERROR,
          409,
        );
      }

      throw error;
    }

    if (rows.length < 100) {
      return cursor;
    }

    offset += rows.length;
  }
}
