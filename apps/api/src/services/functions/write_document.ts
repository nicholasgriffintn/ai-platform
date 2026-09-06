import {
  DOCUMENT_CAPABILITY_ID,
  DOCUMENT_WRITE_TOOL_NAME,
  type WriteDocumentInput,
} from "@ngriffin_uk/polychat-schemas";

import { writeDocument } from "~/services/documents";
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
    const user = request.user;

    if (!context || !user?.id) {
      throw new AssistantError(
        "Writing a document needs a signed-in user",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    const projectId = args.projectId ?? resolveRequestProjectId(request) ?? undefined;
    const saved = await writeDocument(context, user, {
      title: args.title,
      body: args.body,
      capabilityId: DOCUMENT_CAPABILITY_ID,
      sourceType: "assistant",
      ...(args.outputId ? { outputId: args.outputId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(request.request?.completion_id ? { conversationId: request.request.completion_id } : {}),
    });

    return {
      status: "success",
      name: DOCUMENT_WRITE_TOOL_NAME,
      content: args.outputId
        ? `Revised ${saved.title}. It is revision ${saved.revision} in Files.`
        : `Wrote ${saved.title}. You can find it in Files, revise it, or export it.`,
      data: { outputId: saved.id, title: saved.title, revision: saved.revision },
    } satisfies IFunctionResponse;
  },
};
