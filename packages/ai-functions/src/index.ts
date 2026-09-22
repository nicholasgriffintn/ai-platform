import type { ProviderRuntime } from "@ngriffin_uk/polychat-ai-providers";

import { createAi, type Ai } from "./ai.js";
import { createDecisionPolicyFunctions, type DecisionPolicyFunctions } from "./decision-policy.js";
import { createDecisionFunctions, type DecisionFunctions } from "./decisions.js";
import { createMediaFunctions, type MediaFunctions } from "./media.js";
import { createRerankingFunctions, type RerankingFunctions } from "./reranking.js";
import { createRetrievalFunctions, type RetrievalFunctions } from "./retrieval.js";
import { createTextFunctions, type TextFunctions } from "./text.js";
import type { CompletionRequest } from "./types.js";

export type AiFunctions = Ai &
  DecisionFunctions &
  DecisionPolicyFunctions &
  TextFunctions &
  MediaFunctions &
  RetrievalFunctions &
  RerankingFunctions & {
    template(
      scope: CompletionRequest,
    ): (strings: TemplateStringsArray, ...values: unknown[]) => Promise<string>;
  };

export function createAiFunctions(runtime: ProviderRuntime): AiFunctions {
  const ai = createAi(runtime);
  const decisions = createDecisionFunctions(runtime);

  return {
    ...ai,
    ...decisions,
    ...createDecisionPolicyFunctions(decisions),
    ...createTextFunctions(ai, decisions),
    ...createMediaFunctions(runtime),
    ...createRetrievalFunctions(runtime),
    ...createRerankingFunctions(runtime),
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
export {
  createDecisionPolicyFunctions,
  defineDecisionPolicy,
  type DecisionPolicyDefinition,
  type DecisionPolicyFailure,
  type DecisionPolicyFunctions,
  type DecisionPolicyReceipt,
  type DecisionPolicyRecommendation,
  type DecisionPolicyResult,
  type DecisionPolicyStatus,
  type EvaluateDecisionPolicyRequest,
} from "./decision-policy.js";
export {
  createDecisionFunctions,
  type DecideRequest,
  type DecideResult,
  type DecisionFunctions,
  type DecisionScope,
  type DecisionTarget,
} from "./decisions.js";
export { createMediaFunctions, type MediaFunctions, type MediaRoutingOptions } from "./media.js";
export { choice, noul, score } from "./questions.js";
export {
  createRerankingFunctions,
  type RerankRequest,
  type RerankResult,
  type RerankedDocument,
  type RerankingFunctions,
  type RerankingScope,
  type RerankingTarget,
} from "./reranking.js";
export {
  createRetrievalFunctions,
  type GuardRequest,
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
  type ScoreRequest,
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
