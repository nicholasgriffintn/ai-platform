import type { IFunction, IRequest } from "../../types";
import { handlePromptCoachSuggestion } from "../apps/prompt-coach";

export const prompt_coach: IFunction = {
  name: "prompt_coach",
  description:
    "Given a prompt, this function will return an enhanced variant with suggestions for improvement.",
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "The prompt to improve",
      },
      recursionDepth: {
        type: "number",
        description: "The depth of the recursive search",
      },
      promptType: {
        type: "string",
        description: "The type of prompt",
      },
    },
    required: ["prompt"],
  },
  function: async (
    completion_id: string,
    args: any,
    req: IRequest,
    app_url?: string,
  ) => {
    if (!args.prompt) {
      return {
        status: "error",
        name: "prompt_coach",
        content: "Missing prompt",
        data: {},
      };
    }

    const response = await handlePromptCoachSuggestion({
      env: req.env,
      user: req.user,
      prompt: args.prompt,
      recursionDepth: args.recursionDepth,
      promptType: args.promptType,
    });

    return {
      status: "success",
      name: "prompt_coach",
      content: "Prompt coach response",
      data: response,
    };
  },
};
