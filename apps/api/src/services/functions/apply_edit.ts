import { handleCreateApplyEditCompletions } from "~/services/completions/createApplyEditCompletions";

import type { ApiToolDefinition } from "../../types/functions";
import { apply_edit_completion as apply_edit_completionDescriptor } from "./definitions/apply_edit";

export const apply_edit_completion: ApiToolDefinition = {
  ...apply_edit_completionDescriptor,
  execute: async (args, context) => {
    const req = context.request;

    if (!args.prompt || typeof args.prompt !== "string") {
      return {
        status: "error",
        name: "apply_edit_completion",
        content: "A prompt string is required to apply an edit.",
        role: "tool",
      };
    }

    const response = await handleCreateApplyEditCompletions({
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
        name: "apply_edit_completion",
        content: "The edit model did not return a result.",
        data: response,
        role: "tool",
      };
    }

    return {
      status: "success",
      name: "apply_edit_completion",
      content: completionText,
      data: {
        model: response?.model ?? args.model,
        raw: response,
      },
      role: "tool",
    };
  },
};
