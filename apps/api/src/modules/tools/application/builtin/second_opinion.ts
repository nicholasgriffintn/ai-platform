import { resolveTierModel } from "@ngriffin_uk/polychat-ai-models";
import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";
import { stringifyMessageContent } from "@ngriffin_uk/polychat-ai-providers";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import { MAX_REVIEWERS, MAX_SOURCE_LENGTH } from "~/config/limits";
import { getLineupModelsForUser } from "~/modules/models/application/resolve";
import {
  runPanel,
  type PanelMember,
  type PanelTurn,
} from "~/modules/responses/application/engine/panel";
import type { IEnv, IUser } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";

import { second_opinion as second_opinionDescriptor } from "./definitions/second_opinion";

const REVIEW_BRIEF = getPromptText("apps/functions/second-opinion-brief");

const CONCLUSION_BRIEF = getPromptText("apps/functions/second-opinion-conclusion");

function toReviewer(config: ModelConfigItem, index: number): PanelMember {
  return {
    id: `reviewer_${index + 1}`,
    name: config.name || config.matchingModel,
    role: "Reviewer",
    instruction: getPromptText("apps/functions/second-opinion-reviewer"),
    model: config.matchingModel,
    provider: config.provider,
  };
}

export async function resolveReviewers(
  modelIds: readonly string[],
  env: IEnv,
  user: IUser | undefined,
  answeringModel: string | undefined,
): Promise<PanelMember[]> {
  const lineup = await getLineupModelsForUser(env, user);
  const available = Object.values(lineup);
  const requested = modelIds
    .slice(0, MAX_REVIEWERS)
    .flatMap(
      (modelId) => lineup[modelId] ?? available.find((m) => m.matchingModel === modelId) ?? [],
    );

  if (requested.length > 0) {
    return requested.map(toReviewer);
  }

  const fallback = resolveTierModel(lineup, user, "medium", "agent", {
    isEligible: (model) => model.matchingModel !== answeringModel,
  });

  return fallback ? [toReviewer(fallback.config, 0)] : [];
}

function buildTurnResponse(turn: PanelTurn) {
  return {
    status: "success" as const,
    name: "second_opinion_turn",
    content: turn.content,
    data: {
      renderer: "second_opinion_turn",
      memberId: turn.memberId,
      memberName: turn.memberName,
      memberRole: turn.memberRole,
      model: turn.model,
      turn: turn.turn,
      content: turn.content,
    },
  };
}

async function resolveAnswerUnderReview(
  context: Parameters<NonNullable<ApiToolDefinition["execute"]>>[1],
  provided?: string,
): Promise<{ answer: string; question: string }> {
  if (provided) {
    return { answer: provided.slice(0, MAX_SOURCE_LENGTH), question: "" };
  }

  const history =
    (await context.conversationManager?.get(context.completionId).catch(() => [])) ?? [];
  const lastAssistant = [...history].reverse().find((message) => message.role === "assistant");
  const lastUser = [...history].reverse().find((message) => message.role === "user");

  return {
    answer: stringifyMessageContent(lastAssistant?.content).slice(0, MAX_SOURCE_LENGTH),
    question: stringifyMessageContent(lastUser?.content).slice(0, MAX_SOURCE_LENGTH),
  };
}

export const second_opinion: ApiToolDefinition = {
  ...second_opinionDescriptor,
  execute: async (args, context) => {
    const request = context.request;
    const members = await resolveReviewers(
      args.models as string[],
      request.env,
      request.user,
      request.request?.model,
    );

    if (members.length === 0) {
      return {
        status: "error",
        name: "second_opinion",
        content: "None of the requested models are available to review the answer.",
      };
    }

    const { answer, question } = await resolveAnswerUnderReview(
      context,
      args.answer as string | undefined,
    );

    if (!answer.trim()) {
      return {
        status: "error",
        name: "second_opinion",
        content: "There is no answer in this conversation to review yet.",
      };
    }

    const brief = [
      question ? `The user asked:\n${question}` : null,
      `The answer under review:\n${answer}`,
      args.focus ? `The user wants this checked in particular: ${args.focus}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    let result: Awaited<ReturnType<typeof runPanel>>;

    try {
      result = await runPanel({
        env: request.env,
        completionId: context.completionId,
        usageScopeId: context.toolCallId ?? context.completionId,
        runId: request.request?.run_id,
        runAttempt: request.request?.run_attempt,
        user: request.user,
        model: request.request?.model,
        provider: request.request?.provider,
        question: brief,
        members,
        turnBrief: REVIEW_BRIEF,
        conclusionBrief: CONCLUSION_BRIEF,
        maxTurns: Math.max(members.length, 2),
        onTurn: async (turn) => {
          await context.emitToolResult?.(buildTurnResponse(turn));
        },
      });
    } catch (error) {
      return {
        status: "error",
        name: "second_opinion",
        content: `No review took place, so nothing was checked. Tell the user the second opinion failed: ${getErrorMessage(error, "the reviewers did not respond")}`,
      };
    }

    return {
      status: "success",
      name: "second_opinion",
      content: `<second_opinion>\n${result.conclusion}\n</second_opinion>`,
      data: {
        renderer: "second_opinion",
        models: members.map((member) => member.model),
        turns: result.turns,
        conclusion: result.conclusion,
        stoppedReason: result.stoppedReason,
      },
    };
  },
};
