import { queryEmbeddings } from "~/services/apps/embeddings/query";
import { AssistantError, ErrorType } from "~/utils/errors";

import type { ApiToolDefinition } from "../../types/functions";
import { get_note as get_noteDescriptor } from "./definitions/get_note";
import { resolveRequestProjectId } from "./request-context";

export const get_note: ApiToolDefinition = {
  ...get_noteDescriptor,
  execute: async (args, context) => {
    const req = context.request;

    if (resolveRequestProjectId(req)) {
      throw new AssistantError(
        "Project document retrieval is not available yet",
        ErrorType.CONFIGURATION_ERROR,
        501,
      );
    }

    if (!args.query) {
      return {
        status: "error",
        name: "get_note",
        content: "Missing query",
        data: {},
      };
    }

    const response = await queryEmbeddings({
      request: {
        query: String(args.query),
        type: "note",
      },
      context: req.context,
      env: req.env,
      user: req.user,
    });

    if (!response.data) {
      return {
        status: "error",
        name: "get_note",
        content: "Error getting note",
        data: {},
      };
    }

    return {
      status: "success",
      name: "get_note",
      content: "Notes retrieved successfully",
      data: response.data,
    };
  },
};
