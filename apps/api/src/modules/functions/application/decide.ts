import type z from "zod/v4";

import { decide as runDecision } from "~/modules/decisions/application/decide";
import { formatDecisionAnswer } from "~/modules/functions/utils/decision-answers";
import type { IRequest } from "~/types";
import type { ApiToolDefinition, ApiToolExecutionContext } from "~/types/functions";

import { decide as decideDescriptor } from "./definitions/decide";

type DecisionToolContext = Pick<ApiToolExecutionContext, "completionId"> & {
  request?: Pick<IRequest, "env" | "user">;
};

export const decide = {
  ...decideDescriptor,
  execute: async (
    args: z.infer<typeof decideDescriptor.inputSchema>,
    context: DecisionToolContext,
  ) => {
    const request = context.request;

    if (!request?.user) {
      return {
        status: "error",
        name: "decide",
        content: "Decisions need a signed-in account.",
        data: {},
      };
    }

    const response = await runDecision({
      env: request.env,
      user: request.user,
      request: {
        state: args.state,
        questions: args.questions,
        model: args.model === "auto" ? undefined : args.model,
      },
      completionId: context.completionId,
    });
    const lines = Object.entries(response.answers).map(([id, answer]) =>
      formatDecisionAnswer(id, answer),
    );

    return {
      status: "success",
      name: "decide",
      content: lines.join("\n"),
      data: {
        provider: response.provider,
        model: response.model,
        answers: response.answers,
        usage: response.usage,
      },
    };
  },
} satisfies ApiToolDefinition;
