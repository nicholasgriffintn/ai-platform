import { getPromptText, renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import z from "zod/v4";

import type { Ai } from "./ai.js";
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
}

export interface SummariseRequest extends TextTaskRequest {
  input: string;
  style?: string;
  maxWords?: number;
}

export interface IsRequest extends TextTaskRequest {
  statement: string;
  context?: string;
}

export function createTextFunctions(ai: Ai) {
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
      ...scope
    }: ClassifyRequest<TLabel>): Promise<TLabel> => {
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
    is: async ({ statement, context, ...scope }: IsRequest): Promise<boolean> => {
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
