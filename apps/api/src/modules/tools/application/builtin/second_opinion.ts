import { resolveTierModel } from "@ngriffin_uk/polychat-ai-models";
import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";
import {
  extractTextFromMessageContent,
  stringifyMessageContent,
} from "@ngriffin_uk/polychat-ai-providers";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { describeValue, isRecord } from "@ngriffin_uk/polychat-utility-core";

import { MAX_SOURCE_LENGTH } from "~/config/limits";
import { getLineupModelsForUser } from "~/modules/models/application/resolve";
import {
  runPanel,
  type PanelMember,
  type PanelTurn,
} from "~/modules/responses/application/engine/panel";
import type { IEnv, IUser, Message } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";

import { second_opinion as second_opinionDescriptor } from "./definitions/second_opinion";

const MAX_SECOND_OPINION_REVIEWERS = 2;
const REVIEWER_TIERS = ["high", "medium", "low"] as const;

interface ReviewMaterial {
  answer: string;
  question: string;
  toolResults: string;
}

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
  env: IEnv,
  user: IUser | undefined,
  answeringModel: string | undefined,
): Promise<PanelMember[]> {
  const lineup = await getLineupModelsForUser(env, user);
  const reviewers: ModelConfigItem[] = [];

  for (const tier of REVIEWER_TIERS) {
    const next = resolveTierModel(lineup, user, tier, "agent", {
      isEligible: (model) =>
        model.matchingModel !== answeringModel &&
        !reviewers.some((reviewer) => reviewer.provider === model.provider),
    });

    if (next && reviewers.length < MAX_SECOND_OPINION_REVIEWERS) {
      reviewers.push(next.config);
    }
  }

  return reviewers.map(toReviewer);
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

function isReviewableToolResult(message: Message): boolean {
  return (
    message.role === "tool" &&
    !message.name?.startsWith("second_opinion") &&
    !(isRecord(message.data) && message.data.modelContext === false)
  );
}

function describeToolResult(message: Message): string {
  const output = [extractTextFromMessageContent(message.content), describeValue(message.data)]
    .filter(Boolean)
    .join("\n");

  return `${message.name ?? "Tool"}:\n${output}`;
}

export function readReviewMaterial(history: Message[], provided?: string): ReviewMaterial {
  const newestFirst = [...history].reverse();
  const answerPosition = newestFirst.findIndex(
    (message) => message.role === "assistant" && !message.tool_calls?.length,
  );
  const beforeAnswer = newestFirst.slice(answerPosition + 1);
  const questionPosition = beforeAnswer.findIndex((message) => message.role === "user");
  const answer = provided ?? stringifyMessageContent(newestFirst[answerPosition]?.content);

  return {
    answer: answer.slice(0, MAX_SOURCE_LENGTH),
    question: stringifyMessageContent(beforeAnswer[questionPosition]?.content).slice(
      0,
      MAX_SOURCE_LENGTH,
    ),
    toolResults: beforeAnswer
      .slice(0, Math.max(questionPosition, 0))
      .filter(isReviewableToolResult)
      .reverse()
      .map(describeToolResult)
      .join("\n\n")
      .slice(0, MAX_SOURCE_LENGTH),
  };
}

export const second_opinion: ApiToolDefinition = {
  ...second_opinionDescriptor,
  execute: async (args, context) => {
    const request = context.request;
    const members = await resolveReviewers(request.env, request.user, request.request?.model);

    if (members.length === 0) {
      return {
        status: "error",
        name: "second_opinion",
        content: "No other models are available to review this answer.",
      };
    }

    const history =
      (await context.conversationManager?.get(context.completionId).catch(() => [])) ?? [];
    const { answer, question, toolResults } = readReviewMaterial(
      history,
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
      toolResults ? `What the tools returned for this answer:\n${toolResults}` : null,
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
    } catch {
      return {
        status: "error",
        name: "second_opinion",
        content: "The second opinion did not run, so nothing was checked.",
      };
    }

    return {
      status: "success",
      name: "second_opinion",
      content: `<second_opinion>\n${result.conclusion}\n</second_opinion>`,
      data: {
        renderer: "second_opinion",
        models: members.map((member) => member.name),
        turns: result.turns,
        conclusion: result.conclusion,
        stoppedReason: result.stoppedReason,
      },
    };
  },
};
