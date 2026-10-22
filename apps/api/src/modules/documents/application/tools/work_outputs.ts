import {
  DECK_CAPABILITY_ID,
  DECK_OUTPUT_KIND,
  DECK_WRITE_TOOL_NAME,
  SHEET_CAPABILITY_ID,
  SHEET_OUTPUT_KIND,
  SHEET_WRITE_TOOL_NAME,
  type Output,
  type WriteDeckInput,
  type WriteSheetInput,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { writeWorkOutput } from "~/modules/documents/application/work-outputs";
import { resolveRequestProjectId } from "~/modules/tools/application/request-context";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition, ApiToolExecutionContext } from "~/types/functions";

import {
  write_deck as writeDeckDescriptor,
  write_sheet as writeSheetDescriptor,
} from "./definitions/work_outputs";

function resolveWriteScope(
  toolContext: ApiToolExecutionContext,
  requestedProjectId: string | undefined,
) {
  const request = toolContext.request;
  const context = request.context;
  const user = request.user;

  if (!context || !user?.id) {
    throw new AssistantError(
      "Writing a file needs a signed-in user",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  const requestProjectId = resolveRequestProjectId(request);

  if (requestProjectId && requestedProjectId && requestProjectId !== requestedProjectId) {
    throw new AssistantError("That file is outside this project", ErrorType.FORBIDDEN, 403);
  }

  const projectId = requestProjectId ?? requestedProjectId;
  const conversationId = request.request?.completion_id;

  return {
    context,
    userId: user.id,
    ...(projectId ? { projectId } : {}),
    ...(conversationId ? { conversationId } : {}),
  };
}

function describeSaved(
  name: string,
  saved: Output,
  revised: boolean,
  summary: string,
): IFunctionResponse {
  return {
    status: "success",
    name,
    content: revised
      ? `Revised ${saved.title} (${summary}). It is revision ${saved.revision} in Files.`
      : `Wrote ${saved.title} (${summary}). It is in Files to open, revise or share.`,
    data: {
      renderer: "work_output",
      outputId: saved.id,
      kind: saved.kind,
      title: saved.title,
      revision: saved.revision,
      content: saved.content,
    },
  };
}

export const write_deck: ApiToolDefinition = {
  ...writeDeckDescriptor,
  execute: async (args: WriteDeckInput, toolContext) => {
    const { context, userId, ...scope } = resolveWriteScope(toolContext, args.projectId);
    const saved = await writeWorkOutput(context, userId, {
      kind: DECK_OUTPUT_KIND,
      capabilityId: DECK_CAPABILITY_ID,
      title: args.title,
      content: { format: "slides", slides: args.slides },
      ...(args.outputId ? { outputId: args.outputId } : {}),
      ...(args.expectedRevision ? { expectedRevision: args.expectedRevision } : {}),
      ...scope,
    });

    return describeSaved(
      DECK_WRITE_TOOL_NAME,
      saved,
      Boolean(args.outputId),
      `${args.slides.length} ${args.slides.length === 1 ? "slide" : "slides"}`,
    );
  },
};

export const write_sheet: ApiToolDefinition = {
  ...writeSheetDescriptor,
  execute: async (args: WriteSheetInput, toolContext) => {
    const { context, userId, ...scope } = resolveWriteScope(toolContext, args.projectId);
    const saved = await writeWorkOutput(context, userId, {
      kind: SHEET_OUTPUT_KIND,
      capabilityId: SHEET_CAPABILITY_ID,
      title: args.title,
      content: { format: "tables", tables: args.tables },
      ...(args.outputId ? { outputId: args.outputId } : {}),
      ...(args.expectedRevision ? { expectedRevision: args.expectedRevision } : {}),
      ...scope,
    });
    const rows = args.tables.reduce((total, table) => total + table.rows.length, 0);

    return describeSaved(
      SHEET_WRITE_TOOL_NAME,
      saved,
      Boolean(args.outputId),
      `${args.tables.length} ${args.tables.length === 1 ? "table" : "tables"}, ${rows} ${rows === 1 ? "row" : "rows"}`,
    );
  },
};
