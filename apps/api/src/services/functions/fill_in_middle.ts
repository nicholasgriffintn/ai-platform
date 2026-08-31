import { handleCreateFimCompletions } from "~/services/completions/createFimCompletions";

import type { ApiToolDefinition } from "../../types/functions";
import { fill_in_middle_completion as fill_in_middle_completionDescriptor } from "./definitions/fill_in_middle";

const toOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);

    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
};

export const fill_in_middle_completion: ApiToolDefinition = {
  ...fill_in_middle_completionDescriptor,
  execute: async (args, context) => {
    const req = context.request;

    if (!args.prompt || typeof args.prompt !== "string") {
      return {
        status: "error",
        name: "fill_in_middle_completion",
        content: "A prompt string is required for fill-in-the-middle requests.",
        data: {},
      };
    }

    const stopSequences = Array.isArray(args.stop)
      ? args.stop
          .map((s: unknown) => (typeof s === "string" ? s.trim() : ""))
          .filter((s: string) => s.length > 0)
      : typeof args.stop === "string" && args.stop.trim().length
        ? args.stop
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
        : undefined;

    const response = await handleCreateFimCompletions({
      env: req.env,
      user: req.user,
      model: typeof args.model === "string" ? args.model : undefined,
      prompt: args.prompt,
      suffix: typeof args.suffix === "string" ? args.suffix : undefined,
      max_tokens: toOptionalNumber(args.max_tokens),
      min_tokens: toOptionalNumber(args.min_tokens),
      temperature: toOptionalNumber(args.temperature),
      top_p: toOptionalNumber(args.top_p),
      stop: stopSequences,
    });

    const generatedText =
      typeof response === "string"
        ? response
        : typeof response?.response === "string"
          ? response.response
          : (response?.choices?.[0]?.text ?? "");

    if (!generatedText) {
      return {
        status: "error",
        name: "fill_in_middle_completion",
        content: "The FIM provider did not return any content.",
        data: response,
      };
    }

    return {
      status: "success",
      name: "fill_in_middle_completion",
      content: generatedText,
      data: {
        model:
          (typeof response === "object" && response !== null ? response.model : undefined) ??
          args.model,
        text: generatedText,
        raw: response,
      },
    };
  },
};
