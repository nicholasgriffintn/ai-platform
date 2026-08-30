import { userQuestionSetSchema, type UserQuestion } from "@ngriffin_uk/polychat-schemas";

import type { Message } from "~/types";
import { safeParseJson } from "~/utils/json";

function readMessageData(message: Message): Record<string, unknown> | null {
  if (typeof message.data === "string") {
    return safeParseJson<Record<string, unknown>>(message.data);
  }

  return message.data && typeof message.data === "object" && !Array.isArray(message.data)
    ? message.data
    : null;
}

function normaliseQuestionPrompt(prompt: string): string {
  return prompt.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function findAnsweredQuestion(
  messages: Message[],
  question: UserQuestion,
): UserQuestion | null {
  for (const message of messages) {
    if (message.role !== "tool" || message.name !== "ask_user" || message.status !== "resolved") {
      continue;
    }

    const parsed = userQuestionSetSchema.safeParse(readMessageData(message));

    if (!parsed.success) {
      continue;
    }

    const match = parsed.data.questions.find(
      (answered) =>
        answered.id === question.id ||
        normaliseQuestionPrompt(answered.prompt) === normaliseQuestionPrompt(question.prompt),
    );

    if (match) {
      return match;
    }
  }

  return null;
}
