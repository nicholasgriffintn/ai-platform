import { COMPARISON_RENDERER, COMPARISON_TOOL_NAME } from "@ngriffin_uk/polychat-schemas";

import { resolveComparisonMembers } from "~/modules/decisions/application/comparison-members";
import { describeComparison } from "~/modules/decisions/domain/comparison";
import { findModelConfig } from "~/modules/models/application/resolve";
import { runComparison } from "~/modules/responses/application/engine/comparison";
import type { ApiToolDefinition } from "~/types/functions";

import { compare_and_conclude as compare_and_concludeDescriptor } from "./definitions/comparison";

const ORIGINAL_ANSWER_NAME = "Original answer";

export const compare_and_conclude: ApiToolDefinition = {
  ...compare_and_concludeDescriptor,
  execute: async (args, context) => {
    const request = context.request;
    const answerModel = (args.answerModel as string | undefined) ?? request.request?.model;
    const answerProvider = (args.answerProvider as string | undefined) ?? request.request?.provider;
    const [members, answerConfig] = await Promise.all([
      resolveComparisonMembers(request.env, request.user, {
        model: answerModel,
        provider: answerProvider,
      }),
      answerModel
        ? findModelConfig(answerModel, request.env, answerProvider, request.user?.id)
        : null,
    ]);

    if (members.length === 0) {
      return {
        status: "error",
        name: COMPARISON_TOOL_NAME,
        content: "No other models are available to compare this answer with.",
      };
    }

    const result = await runComparison(
      {
        env: request.env,
        completionId: context.completionId,
        usageScopeId: context.toolCallId ?? context.completionId,
        runId: request.request?.run_id,
        runAttempt: request.request?.run_attempt,
        user: request.user,
        model: request.request?.model,
        provider: request.request?.provider,
      },
      {
        question: String(args.question),
        context: args.context as string | undefined,
        original: {
          name: answerConfig?.name || answerModel || ORIGINAL_ANSWER_NAME,
          model: answerModel,
          content: String(args.answer),
        },
        members,
      },
    );

    return {
      status: "success",
      name: COMPARISON_TOOL_NAME,
      content: describeComparison(result),
      data: { renderer: COMPARISON_RENDERER, ...result },
    };
  },
};
