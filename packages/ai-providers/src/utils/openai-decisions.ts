import {
  decisionAnswersMatchQuestions,
  decisionRequestSchema,
  formatDecisionEntry,
  openaiDecisionResponseSchema,
  type DecisionAnswer,
  type DecisionQuestion,
  type DecisionQuestions,
  type DecisionResponse,
  type OpenAIDecisionAnswer,
  type OpenAIDecisionQuestion,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { DecisionRequest } from "../types/decision.js";

function mapQuestion(name: string, question: DecisionQuestion): OpenAIDecisionQuestion {
  const instructions = formatDecisionEntry(question.instructions);

  if (question.type === "choice") {
    return {
      type: "choice",
      name,
      instructions,
      choices: Object.entries(question.criteria).map(([value, description]) => ({
        value,
        description: formatDecisionEntry(description),
      })),
    };
  }

  if (question.type === "score") {
    return {
      type: "score",
      name,
      instructions,
      levels: question.criteria.map((description, index) => ({
        label: String(index),
        description: formatDecisionEntry(description),
      })),
    };
  }

  return {
    type: "predicate",
    name,
    instructions: question.criteria
      ? `${instructions}\nTrue: ${formatDecisionEntry(question.criteria.true)}\nFalse: ${formatDecisionEntry(question.criteria.false)}`
      : instructions,
  };
}

export function buildOpenAIDecisionRequest(request: DecisionRequest, model: string) {
  const parsed = decisionRequestSchema.safeParse({
    state: request.state,
    questions: request.questions,
    model,
  });

  if (!parsed.success) {
    throw new AssistantError("Invalid OpenAI decision request", ErrorType.PARAMS_ERROR, 400);
  }

  return {
    model,
    input: typeof request.state === "string" ? request.state : JSON.stringify(request.state),
    questions: Object.entries(parsed.data.questions).map(([name, question]) =>
      mapQuestion(name, question),
    ),
  };
}

function invalidResponse(): never {
  throw new AssistantError(
    "OpenAI returned an unexpected decision payload",
    ErrorType.PROVIDER_ERROR,
    502,
  );
}

function mapAnswer(answer: OpenAIDecisionAnswer, question: DecisionQuestion): DecisionAnswer {
  if (answer.type === "refusal") {
    throw new AssistantError("OpenAI refused a decision question", ErrorType.PROVIDER_ERROR, 422);
  }

  if (answer.type === "predicate" && question.type === "noul") {
    return { type: "noul", noul: answer.probability };
  }

  if (answer.type === "choice" && question.type === "choice") {
    if (
      typeof answer.choice !== "string" ||
      answer.probabilities.some(({ value }) => typeof value !== "string") ||
      answer.probabilities.length !== Object.keys(question.criteria).length
    ) {
      return invalidResponse();
    }

    return {
      type: "choice",
      choice: answer.choice,
      confidence: answer.confidence,
      probabilities: Object.fromEntries(
        answer.probabilities.map(({ value, probability }) => [String(value), probability]),
      ),
    };
  }

  if (answer.type === "score" && question.type === "score") {
    if (
      answer.probabilities.length !== question.criteria.length ||
      answer.probabilities.some(({ value, label }) => label !== String(value))
    ) {
      return invalidResponse();
    }

    return {
      type: "score",
      score: answer.score,
      confidence: answer.confidence,
      legend: Object.fromEntries(question.criteria.map((entry, index) => [String(index), entry])),
      probabilities: Object.fromEntries(
        answer.probabilities.map(({ value, probability }) => [String(value), probability]),
      ),
    };
  }

  return invalidResponse();
}

export function normaliseOpenAIDecisionResponse(
  raw: unknown,
  questions: DecisionQuestions,
): DecisionResponse {
  const parsed = openaiDecisionResponseSchema.safeParse(raw);
  const entries = Object.entries(questions);

  if (!parsed.success || parsed.data.answers.length !== entries.length) {
    return invalidResponse();
  }

  const answers = Object.fromEntries(
    parsed.data.answers.map((answer, index): [string, DecisionAnswer] => {
      const entry = entries[index];

      if (!entry || answer.name !== entry[0]) {
        return invalidResponse();
      }

      return [entry[0], mapAnswer(answer, entry[1])];
    }),
  );

  if (!decisionAnswersMatchQuestions(questions, answers)) {
    return invalidResponse();
  }

  return { provider: "openai", model: parsed.data.model, answers, usage: parsed.data.usage };
}
