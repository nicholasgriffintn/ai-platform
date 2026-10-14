import {
  TWENTY_QUESTIONS_MAX_QUESTIONS,
  isDecisionAnswerOfType,
  readDecisionNoul,
  roundDecisionScore,
  twentyQuestionsCategorySchema,
  type DecisionQuestions,
  type TwentyQuestionsAnswer,
  type TwentyQuestionsCategory,
  type TwentyQuestionsGame,
  type TwentyQuestionsReveal,
} from "@ngriffin_uk/polychat-schemas";
import { pickRandom } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

import { openSecret, sealSecret } from "~/infrastructure/secret-envelope";
import { decide } from "~/modules/decisions/application/decide";
import type { IEnv, IUser } from "~/types";

import { TWENTY_QUESTIONS_SECRETS } from "./secrets";

const WARMTH_LEVELS = [
  "Freezing: nothing to do with the secret",
  "Cold: a different kind of thing altogether",
  "Warm: the right sort of thing",
  "Hot: circling something very close",
  "Burning: all but named it",
];

const ANSWER_QUESTIONS = {
  answerable: {
    type: "noul",
    instructions: "Can `question` be answered with a plain yes or no?",
  },
  yes: {
    type: "noul",
    instructions:
      "Answer `question` honestly about `secret`, using common knowledge. Is the true answer yes?",
  },
  guess: {
    type: "noul",
    instructions: "Is `question` a direct guess at one specific thing, like 'Is it a cat?'",
  },
  correct: {
    type: "noul",
    instructions:
      "Does `question` name `secret` itself? Synonyms, plurals and close spellings count; broader categories do not.",
  },
  warmth: {
    type: "score",
    instructions: "How close is the thinking behind `question` to `secret`?",
    criteria: WARMTH_LEVELS,
  },
} satisfies DecisionQuestions;

const tokenPayloadSchema = z.object({
  category: twentyQuestionsCategorySchema,
  secret: z.string().min(1),
});

type TokenPayload = z.infer<typeof tokenPayloadSchema>;

async function readToken(env: IEnv, token: string): Promise<TokenPayload> {
  const opened = await openSecret(env, token).catch(() => null);
  const parsed = tokenPayloadSchema.safeParse(opened ? safeParseJson(opened) : null);

  if (!parsed.success) {
    throw new AssistantError(
      "That game has gone missing. Start a new one.",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return parsed.data;
}

export async function startTwentyQuestions(
  env: IEnv,
  category: TwentyQuestionsCategory,
): Promise<TwentyQuestionsGame> {
  const secret = pickRandom(TWENTY_QUESTIONS_SECRETS[category]);

  if (!secret) {
    throw new AssistantError("That category is empty", ErrorType.CONFIGURATION_ERROR);
  }

  return {
    token: await sealSecret(env, JSON.stringify({ category, secret })),
    category,
    maxQuestions: TWENTY_QUESTIONS_MAX_QUESTIONS,
  };
}

export async function askTwentyQuestions(
  env: IEnv,
  user: IUser,
  token: string,
  question: string,
): Promise<TwentyQuestionsAnswer> {
  const { category, secret } = await readToken(env, token);
  const response = await decide({
    env,
    user,
    request: { state: { category, secret, question }, questions: ANSWER_QUESTIONS },
  });
  const { answers } = response;
  const isGuess = readDecisionNoul(answers, "guess") >= 0.5;
  const correct = readDecisionNoul(answers, "correct");
  const solved = isGuess && correct >= 0.5;
  const warmthAnswer = answers.warmth;
  const warmth = solved
    ? WARMTH_LEVELS.length - 1
    : isDecisionAnswerOfType(warmthAnswer, "score")
      ? roundDecisionScore(warmthAnswer)
      : 0;

  return {
    question,
    kind: isGuess
      ? "guess"
      : readDecisionNoul(answers, "answerable") < 0.4
        ? "unanswerable"
        : "question",
    yes: isGuess ? correct : readDecisionNoul(answers, "yes"),
    warmth: { level: warmth, label: WARMTH_LEVELS[warmth]?.split(":")[0] ?? "" },
    solved,
    secret: solved ? secret : null,
  };
}

export async function revealTwentyQuestions(
  env: IEnv,
  token: string,
): Promise<TwentyQuestionsReveal> {
  const { secret } = await readToken(env, token);

  return { secret };
}
