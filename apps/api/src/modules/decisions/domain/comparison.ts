import { stringifyMessageContent } from "@ngriffin_uk/polychat-ai-providers";
import {
  comparisonConclusionSchema,
  type ComparisonConclusion,
  type ComparisonResult,
} from "@ngriffin_uk/polychat-schemas";
import { truncateForModel } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseAIResponseJson } from "@ngriffin_uk/polychat-utility-server/json";

import { MAX_SOURCE_LENGTH } from "~/config/limits";
import type { Message } from "~/types";

const CONTEXT_MESSAGES = 6;
const CONTEXT_MESSAGE_CHARS = 2_000;

export interface ComparisonSubject {
  question: string;
  answer: string;
  context?: string;
  answerModel?: string;
  answerProvider?: string;
}

function readText(message: Message): string {
  return stringifyMessageContent(message.content).trim();
}

function isTurnWithText(message: Message): boolean {
  return (message.role === "user" || message.role === "assistant") && Boolean(readText(message));
}

export function resolveComparisonSubject(
  messages: readonly Message[],
  sourceMessageId: string,
): ComparisonSubject {
  const sourceIndex = messages.findIndex((message) => message.id === sourceMessageId);
  const source = messages[sourceIndex];
  const answer = source?.role === "assistant" ? readText(source) : "";

  if (!source || !answer) {
    throw new AssistantError("That reply is not available to compare", ErrorType.PARAMS_ERROR, 400);
  }

  const earlier = messages.slice(0, sourceIndex).filter(isTurnWithText);
  const questionIndex = earlier.map((message) => message.role).lastIndexOf("user");

  if (questionIndex === -1) {
    throw new AssistantError("That reply has no question to compare", ErrorType.PARAMS_ERROR, 400);
  }

  const context = earlier
    .slice(Math.max(0, questionIndex - CONTEXT_MESSAGES), questionIndex)
    .map(
      (message) => `${message.role}: ${truncateForModel(readText(message), CONTEXT_MESSAGE_CHARS)}`,
    )
    .join("\n\n");

  return {
    question: readText(earlier[questionIndex]).slice(0, MAX_SOURCE_LENGTH),
    answer: answer.slice(0, MAX_SOURCE_LENGTH),
    ...(context ? { context: context.slice(0, MAX_SOURCE_LENGTH) } : {}),
    ...(source.model ? { answerModel: source.model } : {}),
    ...(source.provider ? { answerProvider: source.provider } : {}),
  };
}

export function readComparisonConclusion(raw: string): ComparisonConclusion {
  const parsed = comparisonConclusionSchema.safeParse(parseAIResponseJson(raw).data);

  return parsed.success
    ? parsed.data
    : { agreements: [], disagreements: [], conclusion: raw.trim() };
}

export function describeComparison(result: ComparisonResult): string {
  const agreements = result.agreements.map((point) => `- ${point}`);
  const disagreements = result.disagreements.map(
    ({ point, positions }) =>
      `- ${point} (${positions.map(({ model, position }) => `${model}: ${position}`).join("; ")})`,
  );

  return [
    result.conclusion,
    agreements.length ? `Models agreed:\n${agreements.join("\n")}` : null,
    disagreements.length ? `Models disagreed:\n${disagreements.join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}
