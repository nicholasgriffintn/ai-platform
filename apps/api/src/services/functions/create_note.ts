import { insertEmbedding } from "~/services/apps/embeddings/insert";
import { AssistantError, ErrorType } from "~/utils/errors";
import { isRecord } from "~/utils/objects";
import { sanitiseInput } from "~/utils/sanitise";

import type { ApiToolDefinition } from "../../types/functions";
import { create_note as create_noteDescriptor } from "./definitions/create_note";
import { resolveRequestProjectId } from "./request-context";

export const create_note: ApiToolDefinition = {
  ...create_noteDescriptor,
  execute: async (args, context) => {
    const req = context.request;

    if (resolveRequestProjectId(req)) {
      throw new AssistantError(
        "Project document storage is not available yet",
        ErrorType.CONFIGURATION_ERROR,
        501,
      );
    }

    const sanitisedTitle = sanitiseInput(args.title);
    const sanitisedContent = sanitiseInput(args.content);

    if (!sanitisedTitle || !sanitisedContent) {
      return {
        status: "error",
        name: "create_note",
        content: "Missing title or content",
        data: {},
      };
    }

    const response = await insertEmbedding({
      request: {
        type: "note",
        title: sanitisedTitle,
        content: sanitisedContent,
        ...(isRecord(args.metadata) && { metadata: args.metadata }),
      },
      context: req.context,
      env: req.env,
      user: req.user,
    });

    if (!response.data) {
      return {
        status: "error",
        name: "create_note",
        content: "Error creating note",
        data: {},
      };
    }

    return {
      status: "success",
      name: "create_note",
      content: "Note created successfully",
      data: response.data,
    };
  },
};
