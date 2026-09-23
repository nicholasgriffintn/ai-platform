import { getPromptText, renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import {
  decisionNoulIsTrue,
  type DecisionEntry,
  type DecisionScoreAnswer,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { Ai } from "./ai.js";
import type { DecisionFunctions } from "./decisions.js";
import { choice, noul, score as scoreQuestion } from "./questions.js";
import type { CompletionRequest } from "./types.js";

export type TextTaskRequest = Omit<CompletionRequest, "prompt" | "messages">;

export interface ListRequest extends TextTaskRequest {
  prompt: string;
  count?: number;
}

export interface ExtractRequest<TObject> extends TextTaskRequest {
  input: string;
  schema: z.ZodType<TObject>;
  instructions?: string;
}

export interface ClassifyRequest<TLabel extends string> extends TextTaskRequest {
  input: string;
  labels: readonly TLabel[];
  instructions?: string;
  descriptions?: Partial<Record<TLabel, DecisionEntry>>;
}

export interface ScoreRequest extends TextTaskRequest {
  input: string;
  levels: readonly DecisionEntry[];
  instructions: string;
}

export interface SummariseRequest extends TextTaskRequest {
  input: string;
  style?: string;
  maxWords?: number;
}

export interface IsRequest extends TextTaskRequest {
  statement: string;
  context?: string;
  threshold?: number;
}

const DEFAULT_CLASSIFY_INSTRUCTIONS = "Which label best describes the input?";

function decisionScope<TRequest extends TextTaskRequest>(scope: TRequest) {
  return {
    env: scope.env,
    user: scope.user,
    completion_id: scope.completion_id,
  };
}

export function createTextFunctions(ai: Ai, decisions: DecisionFunctions) {
  return {
    list: async ({ prompt, count, ...scope }: ListRequest): Promise<string[]> => {
      const countInstruction = count
        ? renderPrompt("functions/text/list-count", { count })
        : getPromptText("functions/text/list-all");
      const { object } = await ai.generateObject({
        ...scope,
        name: "list",
        schema: z.object({ items: z.array(z.string()) }),
        system: renderPrompt("functions/text/list", { countInstruction }),
        prompt,
      });

      return count ? object.items.slice(0, count) : object.items;
    },
    extract: async <TObject>({
      input,
      schema,
      instructions,
      ...scope
    }: ExtractRequest<TObject>): Promise<TObject> => {
      const { object } = await ai.generateObject({
        ...scope,
        name: "extraction",
        schema,
        system: [getPromptText("functions/text/extract"), instructions].filter(Boolean).join(" "),
        prompt: input,
      });

      return object;
    },
    classify: async <TLabel extends string>({
      input,
      labels,
      instructions,
      descriptions,
      ...scope
    }: ClassifyRequest<TLabel>): Promise<TLabel> => {
      const decided = await decisions.tryDecide({
        ...decisionScope(scope),
        state: input,
        questions: {
          label: choice(
            instructions ?? DEFAULT_CLASSIFY_INSTRUCTIONS,
            Object.fromEntries(
              labels.map((label) => [label, descriptions?.[label] ?? null]),
            ) as Record<TLabel, DecisionEntry>,
          ),
        },
      });

      if (decided) {
        return decided.answers.label.choice as TLabel;
      }

      const { object } = await ai.generateObject({
        ...scope,
        name: "classification",
        schema: z.object({ label: z.enum(labels as [TLabel, ...TLabel[]]) }),
        system: [
          renderPrompt("functions/text/classify", { labels: labels.join(", ") }),
          instructions,
        ]
          .filter(Boolean)
          .join(" "),
        prompt: input,
      });

      return object.label;
    },
    score: async ({
      input,
      levels,
      instructions,
      ...scope
    }: ScoreRequest): Promise<DecisionScoreAnswer> => {
      const decided = await decisions.tryDecide({
        ...decisionScope(scope),
        state: input,
        questions: { level: scoreQuestion(instructions, levels) },
      });

      if (decided) {
        return decided.answers.level;
      }

      const topLevel = levels.length - 1;
      const { object } = await ai.generateObject({
        ...scope,
        name: "score",
        schema: z.object({ level: z.number().int().min(0).max(topLevel) }),
        system: renderPrompt("functions/text/score", {
          instructions,
          levels: levels.map((level, index) => `${index}: ${JSON.stringify(level)}`).join("\n"),
        }),
        prompt: input,
      });
      const legend = Object.fromEntries(levels.map((level, index) => [String(index), level]));
      const probabilities = Object.fromEntries(
        levels.map((_level, index) => [String(index), index === object.level ? 1 : 0]),
      );

      return { type: "score", score: object.level, legend, probabilities, confidence: 1 };
    },
    summarise: async ({ input, style, maxWords, ...scope }: SummariseRequest): Promise<string> =>
      ai.generateText({
        ...scope,
        system: [
          getPromptText("functions/text/summarise"),
          style ? renderPrompt("functions/text/summarise-style", { style }) : undefined,
          maxWords ? renderPrompt("functions/text/summarise-max-words", { maxWords }) : undefined,
          getPromptText("functions/text/summarise-reply-only"),
        ]
          .filter(Boolean)
          .join(" "),
        prompt: input,
      }),
    is: async ({ statement, context, threshold, ...scope }: IsRequest): Promise<boolean> => {
      const decided = await decisions.tryDecide({
        ...decisionScope(scope),
        state: context ? { context, statement } : { statement },
        questions: {
          verdict: noul(
            context ? "Is `statement` true, judged against `context`?" : "Is `statement` true?",
          ),
        },
      });

      if (decided) {
        return decisionNoulIsTrue(decided.answers.verdict, threshold);
      }

      const { object } = await ai.generateObject({
        ...scope,
        name: "verdict",
        schema: z.object({ verdict: z.boolean() }),
        system: getPromptText("functions/text/verdict"),
        prompt: context ? `Context:\n${context}\n\nStatement: ${statement}` : statement,
      });

      return object.verdict;
    },
  };
}

export type TextFunctions = ReturnType<typeof createTextFunctions>;
