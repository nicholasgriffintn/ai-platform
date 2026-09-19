import type { ProviderRuntime } from "@ngriffin_uk/polychat-ai-providers";

import { createAi, type Ai } from "./ai.js";
import { createMediaFunctions, type MediaFunctions } from "./media.js";
import { createRetrievalFunctions, type RetrievalFunctions } from "./retrieval.js";
import { createTextFunctions, type TextFunctions } from "./text.js";
import type { CompletionRequest } from "./types.js";

export type AiFunctions = Ai &
  TextFunctions &
  MediaFunctions &
  RetrievalFunctions & {
    template(
      scope: CompletionRequest,
    ): (strings: TemplateStringsArray, ...values: unknown[]) => Promise<string>;
  };

export function createAiFunctions(runtime: ProviderRuntime): AiFunctions {
  const ai = createAi(runtime);

  return {
    ...ai,
    ...createTextFunctions(ai),
    ...createMediaFunctions(runtime),
    ...createRetrievalFunctions(runtime),
    template:
      (scope) =>
      (strings, ...values) =>
        ai.generateText({
          ...scope,
          prompt: strings.reduce(
            (prompt, chunk, index) =>
              `${prompt}${chunk}${index < values.length ? String(values[index]) : ""}`,
            "",
          ),
        }),
  };
}

export {
  buildCompletionMessages,
  createAi,
  extractCompletionMetadata,
  extractCompletionText,
  type Ai,
  type ResolvedCompletionTarget,
  type StructuredRequest,
} from "./ai.js";
export {
  defineFunctions,
  shapeToSchema,
  type DefinedFunctions,
  type FunctionCallScope,
  type FunctionOutput,
  type FunctionShape,
  type FunctionSpec,
  type FunctionSpecs,
} from "./functions.js";
export { createMediaFunctions, type MediaFunctions, type MediaRoutingOptions } from "./media.js";
export {
  createRetrievalFunctions,
  type EmbedRequest,
  type EmbedResult,
  type GuardRequest,
  type RerankRequest,
  type ResearchRequest,
  type RetrievalFunctions,
  type RetrievalScope,
  type SearchRequest,
} from "./retrieval.js";
export {
  createTextFunctions,
  type ClassifyRequest,
  type ExtractRequest,
  type IsRequest,
  type ListRequest,
  type SummariseRequest,
  type TextFunctions,
  type TextTaskRequest,
} from "./text.js";
export type {
  AiRequestScope,
  CompletionMessageContent,
  CompletionMetadata,
  CompletionOverrides,
  CompletionRequest,
  CompletionResult,
  StructuredResult,
} from "./types.js";
