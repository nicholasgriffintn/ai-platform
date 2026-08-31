import { handleCreateNextEditCompletions } from "~/services/completions/createNextEditCompletions";

import type { ApiToolDefinition } from "../../types/functions";
import { next_edit_completion as next_edit_completionDescriptor } from "./definitions/next_edit";

export const next_edit_completion: ApiToolDefinition = {
  ...next_edit_completionDescriptor,
  execute: async (args, context) => {
    const req = context.request;

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
