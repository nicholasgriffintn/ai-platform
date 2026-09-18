import { getPromptText, renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import z from "zod/v4";

import type { Ai } from "./ai.js";
import type { AiRequestScope, CompletionOverrides } from "./types.js";

export type FunctionShape = Record<string, z.ZodType | string | readonly [string]>;

export interface FunctionSpec<TOutput> {
  description?: string;
  output: z.ZodType<TOutput> | FunctionShape;
  model?: string;
  provider?: string;
}

export type FunctionSpecs = Record<string, FunctionSpec<any>>;

export type FunctionOutput<TSpec> =
  TSpec extends FunctionSpec<infer TOutput>
    ? TSpec["output"] extends z.ZodType<TOutput>
      ? TOutput
      : { [K in keyof TSpec["output"]]: ShapeField<TSpec["output"][K]> }
    : never;

type ShapeField<TField> =
  TField extends z.ZodType<infer TValue>
    ? TValue
    : TField extends readonly [string]
      ? string[]
      : string;

export type FunctionCallScope = AiRequestScope & CompletionOverrides & { model?: string };

export type DefinedFunctions<TSpecs extends FunctionSpecs> = {
  [K in keyof TSpecs]: (
    input: string | Record<string, unknown>,
    scope: FunctionCallScope,
  ) => Promise<FunctionOutput<TSpecs[K]>>;
};

export function shapeToSchema(shape: FunctionShape): z.ZodType {
  return z.object(
    Object.fromEntries(
      Object.entries(shape).map(([key, field]) => {
        if (field instanceof z.ZodType) {
          return [key, field];
        }

        if (typeof field === "string") {
          return [key, z.string().describe(field)];
        }

        return [key, z.array(z.string()).describe(field[0])];
      }),
    ),
  );
}

export function defineFunctions<TSpecs extends FunctionSpecs>(
  ai: Ai,
  specs: TSpecs,
): DefinedFunctions<TSpecs> {
  const functions: Record<string, unknown> = {};

  for (const [name, spec] of Object.entries(specs)) {
    const schema = spec.output instanceof z.ZodType ? spec.output : shapeToSchema(spec.output);

    functions[name] = async (input: string | Record<string, unknown>, scope: FunctionCallScope) => {
      const { object } = await ai.generateObject({
        ...scope,
        model: scope.model ?? spec.model,
        provider: spec.provider,
        name,
        schema,
        system: [
          spec.description
            ? renderPrompt("functions/structured/task", { taskDescription: spec.description })
            : undefined,
          getPromptText("functions/structured/response"),
        ]
          .filter(Boolean)
          .join(" "),
        prompt: typeof input === "string" ? input : JSON.stringify(input, null, 2),
      });

      return object;
    };
  }

  return functions as DefinedFunctions<TSpecs>;
}
