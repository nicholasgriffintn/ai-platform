import { DOCUMENT_READ_TOOL_NAME, type ReadDocumentInput } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { requireDocument } from "~/modules/documents/application/access";
import type { ApiToolDefinition } from "~/types/functions";

import { get_document as descriptor } from "./definitions/get_document";

export const get_document: ApiToolDefinition = {
  ...descriptor,
  execute: async (input: ReadDocumentInput, toolContext) => {
    const { context, user } = toolContext.request;

    if (!context || !user) {
      throw new AssistantError(
        "Reading a document needs a signed-in user",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    const { output, body } = await requireDocument(context, user.id, input.outputId);
    const comment = input.commentId
      ? await context.repositories.documentComments.get(output.id, input.commentId, user.id)
      : null;

    if (input.commentId && !comment) {
      throw new AssistantError("Comment not found", ErrorType.NOT_FOUND, 404);
    }

    return {
      status: "success",
      name: DOCUMENT_READ_TOOL_NAME,
      content: `${output.title}, revision ${output.revision}\n\n${body}${comment ? `\n\nComment ${comment.id}: ${comment.body}` : ""}`,
      data: {
        outputId: output.id,
        title: output.title,
        revision: output.revision,
        body,
        comment,
      },
    };
  },
};
