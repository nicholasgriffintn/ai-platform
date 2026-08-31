import { runPanel, type PanelMember, type PanelTurn } from "~/lib/chat/panel";
import { findModelConfig } from "~/lib/providers/models";
import { stringifyMessageContent } from "~/utils/messages";

import type { ApiToolDefinition } from "../../types/functions";
import {
  second_opinion as second_opinionDescriptor,
  MAX_REVIEWERS,
  MAX_SOURCE_LENGTH,
} from "./definitions/second_opinion";

const REVIEW_BRIEF = `You are reviewing another assistant's answer. You are not rewriting it and you are not being polite about it.

- Say what the answer gets right, briefly, then spend your turn on what it gets wrong or leaves out.
- Quote the specific claim you are challenging. A general worry is worth nothing here.
- Mark anything you cannot verify as unverified and say what would settle it.
- Correct the answer only where the correction changes what the reader should do.
- If a previous reviewer already made your point, do not repeat it. Add the consequence they missed, or route onward.
- Stay under 200 words.`;

const CONCLUSION_BRIEF = `You are closing a review of another assistant's answer.

- Lead with the answer the reader should trust, stated in full.
- Name what the reviewers agreed was wrong or missing in the original.
- Record any disagreement between reviewers that a reasonable reader would still hold, and why.
- Do not invent agreement the transcript does not support, and do not summarise who said what.`;

async function resolveReviewers(
  modelIds: readonly string[],
  env: unknown,
  userId?: number,
): Promise<PanelMember[]> {
  const configs = await Promise.all(
    modelIds
      .slice(0, MAX_REVIEWERS)
      .map((modelId) => findModelConfig(modelId, env as never, undefined, userId)),
  );

  return configs.flatMap((config, index) => {
    if (!config) {
      return [];
    }

    return [
      {
        id: `reviewer_${index + 1}`,
        name: config.name || config.matchingModel,
        role: "Reviewer",
        instruction:
          "Review the answer on its merits. Your standing is your own judgement, not agreement with the other reviewers.",
        model: config.matchingModel,
        provider: config.provider,
      },
    ];
  });
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
    const members = await resolveReviewers(args.models as string[], request.env, request.user?.id);

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

    const result = await runPanel({
      env: request.env,
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
