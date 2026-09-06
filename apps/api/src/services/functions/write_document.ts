import {
  DOCUMENT_CAPABILITY_ID,
  DOCUMENT_OUTPUT_KIND,
  DOCUMENT_WRITE_TOOL_NAME,
  type WriteDocumentInput,
} from "@ngriffin_uk/polychat-schemas";

import { createOutput, getOutput, updateOutput } from "~/services/outputs";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";
import { AssistantError, ErrorType } from "~/utils/errors";

import { write_document as writeDocumentDescriptor } from "./definitions/write_document";
import { resolveRequestProjectId } from "./request-context";

export const write_document: ApiToolDefinition = {
  ...writeDocumentDescriptor,
  execute: async (args: WriteDocumentInput, toolContext) => {
    const request = toolContext.request;
    const context = request.context;
    const userId = request.user?.id;

    if (!context || !userId) {
      throw new AssistantError(
        "Writing a document needs a signed-in user",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    const projectId = args.projectId ?? resolveRequestProjectId(request) ?? undefined;
    const content = { format: "markdown" as const, body: args.body };

    if (args.outputId) {
      const existing = await getOutput(context, userId, args.outputId);
      const revised = await updateOutput(context, userId, args.outputId, {
        title: args.title,
        content,
        expectedRevision: existing.revision,
      });

      return {
        status: "success",
        name: DOCUMENT_WRITE_TOOL_NAME,
        content: `Revised ${revised.title}. It is revision ${revised.revision} in Files.`,
        data: { outputId: revised.id, title: revised.title, revision: revised.revision },
      } satisfies IFunctionResponse;
    }

    const created = await createOutput(context, userId, {
      capabilityId: DOCUMENT_CAPABILITY_ID,
      kind: DOCUMENT_OUTPUT_KIND,
      title: args.title,
      status: "ready",
      content,
      ...(projectId ? { projectId } : {}),
      ...(request.request?.completion_id ? { conversationId: request.request.completion_id } : {}),
    });

    return {
      status: "success",
      name: DOCUMENT_WRITE_TOOL_NAME,
      content: `Wrote ${created.title}. You can find it in Files, revise it, or export it.`,
      data: { outputId: created.id, title: created.title, revision: created.revision },
    } satisfies IFunctionResponse;
  },
};
