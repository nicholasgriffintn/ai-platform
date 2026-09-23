import type { ProviderRuntime } from "@ngriffin_uk/polychat-ai-providers";
import type {
  DecisionAnswers,
  DecisionQuestions,
  DecisionResponse,
  DecisionState,
} from "@ngriffin_uk/polychat-schemas";
import { decisionAnswersMatchQuestions } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { AiRequestScope } from "./types.js";

export interface DecisionScope extends AiRequestScope {
  model?: string;
  provider?: string;
  conversationId?: string;
}

export interface DecideRequest<TQuestions extends DecisionQuestions> extends DecisionScope {
  state: DecisionState;
  questions: TQuestions;
}

export interface DecideResult<TQuestions extends DecisionQuestions> extends Omit<
  DecisionResponse,
  "answers"
> {
  answers: DecisionAnswers<TQuestions>;
}

export interface DecisionTarget {
  model: string;
  provider: string;
}

export function createDecisionFunctions(runtime: ProviderRuntime) {
  const resolveDecisionTarget = async (scope: DecisionScope): Promise<DecisionTarget | null> => {
    if (scope.provider) {
      return { provider: scope.provider, model: scope.model ?? "" };
    }

    const target = await runtime.host.models.getAuxiliaryDecisionModel(scope.env, scope.user);

    if (!target) {
      return null;
    }

    return scope.model ? { ...target, model: scope.model } : target;
  };

  const run = async <TQuestions extends DecisionQuestions>(
    request: DecideRequest<TQuestions>,
    target: DecisionTarget,
  ): Promise<DecideResult<TQuestions>> => {
    const provider = runtime.providers.resolve("decision", target.provider, {
      env: request.env,
      user: request.user,
    });
    const response = await provider.decide({
      state: request.state,
      questions: request.questions,
      model: target.model || undefined,
      completion_id: request.completion_id,
      conversationId: request.conversationId,
    });

    const answers = response.answers;

    if (!decisionAnswersMatchQuestions(request.questions, answers)) {
      throw new AssistantError(
        "The decision provider returned answers that do not match the requested questions",
        ErrorType.PROVIDER_ERROR,
      );
    }

    return {
      provider: response.provider,
      model: response.model,
      usage: response.usage,
      answers,
    };
  };

  return {
    resolveDecisionTarget,
    decide: async <TQuestions extends DecisionQuestions>(
      request: DecideRequest<TQuestions>,
    ): Promise<DecideResult<TQuestions>> => {
      const target = await resolveDecisionTarget(request);

      if (!target) {
        throw new AssistantError(
          "No decision model is available for this account",
          ErrorType.CONFIGURATION_ERROR,
        );
      }

      return run(request, target);
    },
    tryDecide: async <TQuestions extends DecisionQuestions>(
      request: DecideRequest<TQuestions>,
    ): Promise<DecideResult<TQuestions> | null> => {
      const target = await resolveDecisionTarget(request);

      return target ? run(request, target) : null;
    },
  };
}

export type DecisionFunctions = ReturnType<typeof createDecisionFunctions>;
