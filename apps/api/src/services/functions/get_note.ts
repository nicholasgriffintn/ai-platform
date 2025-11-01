import { queryEmbeddings } from "~/services/apps/embeddings/query";
import type { IFunction, IRequest } from "~/types";
import { AssistantError, ErrorType } from "../../utils/errors";

export const get_note: IFunction = {
  name: "get_note",
  description:
    "Retrieves previously saved notes based on title, tags, or content search. Use when users reference earlier information, need to continue work on a project, or want to review saved material.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The query to search for",
      },
    },
    required: ["query"],
  },
  type: "premium",
  costPerCall: 0,
  function: async (
    _completion_id: string,
    args: any,
    req: IRequest,
    _app_url?: string,
  ) => {
    // TODO: Remove this once we have a proper way to handle this
    if (req.user?.github_username !== "nicholasgriffintn") {
      throw new AssistantError(
        "This function is not designed for general use yet.",
        ErrorType.AUTHENTICATION_ERROR,
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
        type: "note",
        ...args,
      },
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
