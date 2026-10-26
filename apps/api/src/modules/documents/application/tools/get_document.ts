import { DOCUMENT_READ_TOOL_NAME, type ReadDocumentInput } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { readWorkOutput } from "~/modules/documents/application/work-outputs";
import { DocumentCommentRepository } from "~/modules/documents/infrastructure/DocumentCommentRepository";
import { resolveRequestProjectId } from "~/modules/tools/application/request-context";
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

    const file = await readWorkOutput(
      context,
      user.id,
      input.outputId,
      resolveRequestProjectId(toolContext.request),
    );
    const { output, text } = file;
    const comment = input.commentId
      ? await context.repositories
          .get(DocumentCommentRepository)
          .get({ type: "output", id: output.id }, input.commentId, user.id)
      : null;

    if (input.commentId && !comment) {
      throw new AssistantError("Comment not found", ErrorType.NOT_FOUND, 404);
    }

    return {
      status: "success",
      name: DOCUMENT_READ_TOOL_NAME,
      content: `${output.title} (${file.kind}), revision ${output.revision}\n\n${text}${comment ? `\n\nComment ${comment.id}: ${comment.body}` : ""}`,
      data: {
        outputId: output.id,
        kind: file.kind,
        title: output.title,
        revision: output.revision,
        ...(file.kind === "document" ? { body: text } : { content: file.content }),
        comment,
      },
    };
  },
};
