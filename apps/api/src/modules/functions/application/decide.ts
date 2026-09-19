import { decisionConfidenceBand, type DecisionAnswer } from "@ngriffin_uk/polychat-schemas";

import { decide as runDecision } from "~/modules/decisions/application/decide";
import type { ApiToolDefinition } from "~/types/functions";

import { decide as decideDescriptor } from "./definitions/decide";

function describeAnswer(id: string, answer: DecisionAnswer): string {
  if (answer.type === "noul") {
    return `${id}: ${answer.noul.toFixed(2)} probability of yes`;
  }

  const band = `confidence ${answer.confidence.toFixed(2)}, ${decisionConfidenceBand(answer.confidence)}`;

  if (answer.type === "choice") {
    return `${id}: ${answer.choice} (${band})`;
  }

  const topLevel = Object.keys(answer.legend).length - 1;

  return `${id}: ${answer.score.toFixed(2)} of ${topLevel} (${band})`;
}

export const decide: ApiToolDefinition = {
  ...decideDescriptor,
  execute: async (args, context) => {
    const request = context.request;

    if (!request.user) {
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
      request: { state: args.state, questions: args.questions },
      completionId: context.completionId,
    });
    const lines = Object.entries(response.answers).map(([id, answer]) =>
      describeAnswer(id, answer),
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
};
