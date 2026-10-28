import { extendPreservingAccessors } from "@ngriffin_uk/polychat-utility-core";
import type z from "zod/v4";

import { extractValues } from "~/modules/extractions/application/extract";
import { formatExtractionAnswer } from "~/modules/extractions/application/tools/extraction-answers";
import type { IRequest } from "~/types";
import type { ApiToolDefinition, ApiToolExecutionContext } from "~/types/functions";

import { extract_values as extractValuesDescriptor } from "./definitions/extract_values";

type ExtractionToolContext = Pick<ApiToolExecutionContext, "completionId"> & {
  request?: Pick<IRequest, "env" | "user">;
};

export const extract_values = extendPreservingAccessors(extractValuesDescriptor, {
  execute: async (
    args: z.infer<typeof extractValuesDescriptor.inputSchema>,
    context: ExtractionToolContext,
  ) => {
    const request = context.request;

    if (!request?.user) {
      return {
        status: "error",
        name: "extract_values",
        content: "Extraction needs a signed-in account.",
        data: {},
      };
    }

    const response = await extractValues({
      env: request.env,
      user: request.user,
      request: {
        state: args.state,
        fields: args.fields,
        reference_date: args.reference_date,
      },
      completionId: context.completionId,
    });
    const lines = Object.entries(response.answers).map(([name, answer]) =>
      formatExtractionAnswer(name, answer),
    );

    return {
      status: "success",
      name: "extract_values",
      content: [...lines, ...(response.truncated ? ["The input was truncated."] : [])].join("\n"),
      data: {
        provider: response.provider,
        model: response.model,
        answers: response.answers,
        truncated: response.truncated,
        usage: response.usage,
      },
    };
  },
}) satisfies ApiToolDefinition;
