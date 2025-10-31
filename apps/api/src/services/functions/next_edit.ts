import { handleCreateNextEditCompletions } from "~/services/completions/createNextEditCompletions";
import type { IFunction, IRequest } from "~/types";

export const next_edit_completion: IFunction = {
  name: "next_edit_completion",
  description:
    "Request the next code edit suggestion from Mercury Coder using contextual project snippets.",
  type: "normal",
  costPerCall: 0,
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "Structured prompt containing the current file state, edit history, and target region.",
      },
      model: {
        type: "string",
        description:
          "Optional Mercury model to use for the edit (defaults to the best available).",
      },
    },
    required: ["prompt"],
  },
  function: async (_completionId, args: any, req: IRequest) => {
    if (!args.prompt || typeof args.prompt !== "string") {
      return {
        status: "error",
        name: "next_edit_completion",
        content: "A prompt string is required to generate the next edit.",
        role: "tool",
      };
    }

    const response = await handleCreateNextEditCompletions({
      env: req.env,
      user: req.user,
      model: typeof args.model === "string" ? args.model : undefined,
      messages: [
        {
          role: "user",
          content: args.prompt,
        },
      ],
    });

    const completionText =
      response?.choices?.[0]?.message?.content ??
      response?.choices?.[0]?.text ??
      response?.response ??
      "";

    if (!completionText) {
      return {
        status: "error",
        name: "next_edit_completion",
        content: "The edit model did not return a suggestion.",
        data: response,
        role: "tool",
      };
    }

    return {
      status: "success",
      name: "next_edit_completion",
      content: completionText,
      data: {
        model: response?.model ?? args.model,
        raw: response,
      },
      role: "tool",
    };
  },
};
