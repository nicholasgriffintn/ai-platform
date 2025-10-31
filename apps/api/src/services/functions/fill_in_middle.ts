import { handleCreateFimCompletions } from "~/services/completions/createFimCompletions";
import type { IFunction, IRequest } from "~/types";

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

export const fill_in_middle_completion: IFunction = {
  name: "fill_in_middle_completion",
  description:
    "Generate a fill-in-the-middle completion for code or text by providing the prefix (prompt) and optional suffix. Works across all FIM-capable models.",
  type: "normal",
  costPerCall: 0,
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "Required prefix content that appears before the cursor or gap you want to fill.",
      },
      suffix: {
        type: "string",
        description:
          "Optional suffix content that appears after the cursor or gap.",
      },
      model: (() => {
        return {
          type: "string",
          description:
            "Optional FIM-capable model identifier (defaults to the top recommended model).",
        };
      })(),
      max_tokens: {
        type: "number",
        description: "Maximum number of tokens to generate for the completion.",
        minimum: 1,
      },
      min_tokens: {
        type: "number",
        description: "Minimum number of tokens to generate for the completion.",
        minimum: 0,
      },
      temperature: {
        type: "number",
        description:
          "Sampling temperature between 0 and 2 (higher is spicier). Accepts decimals.",
        minimum: 0,
        maximum: 2,
        multipleOf: 0.01,
      },
      top_p: {
        type: "number",
        description:
          "Top-p nucleus sampling value between 0 and 1 (lower = more focused). Accepts decimals.",
        minimum: 0,
        maximum: 1,
        multipleOf: 0.01,
      },
      stop: {
        type: "string",
        description:
          "Comma-separated list of stop sequences that will terminate generation.",
      },
    },
    required: ["prompt"],
  },
  function: async (_completion_id: string, args: any, req: IRequest) => {
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
          (typeof response === "object" && response !== null
            ? response.model
            : undefined) ?? args.model,
        text: generatedText,
        raw: response,
      },
    };
  },
};
