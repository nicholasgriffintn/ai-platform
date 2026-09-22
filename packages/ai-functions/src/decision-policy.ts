import type {
  DecisionAnswers,
  DecisionQuestions,
  DecisionState,
  DecisionUsage,
} from "@ngriffin_uk/polychat-schemas";

import type { DecideRequest, DecideResult, DecisionFunctions, DecisionScope } from "./decisions.js";

export type DecisionPolicyStatus = "evaluated" | "unavailable" | "failed";
export type DecisionPolicyFailure = "decision_unavailable" | "decision_failed";

export interface DecisionPolicyRecommendation<TOutcome extends string> {
  outcome: TOutcome;
  confidence: number;
  reason: string;
  metrics?: Record<string, number>;
}

export interface DecisionPolicyDefinition<
  TQuestions extends DecisionQuestions,
  TOutcome extends string,
> {
  key: string;
  version: string;
  questions: TQuestions;
  evaluate(answers: DecisionAnswers<TQuestions>): DecisionPolicyRecommendation<TOutcome>;
}

export interface DecisionPolicyReceipt<TOutcome extends string> {
  policy: { key: string; version: string };
  status: DecisionPolicyStatus;
  recommendation?: DecisionPolicyRecommendation<TOutcome>;
  applied: boolean;
  provider?: string;
  model?: string;
  usage?: DecisionUsage;
  failure?: DecisionPolicyFailure;
}

export interface EvaluateDecisionPolicyRequest<
  TQuestions extends DecisionQuestions,
  TOutcome extends string,
> extends DecisionScope {
  state: DecisionState;
  policy: DecisionPolicyDefinition<TQuestions, TOutcome>;
  fallback: TOutcome;
}

export interface DecisionPolicyResult<TOutcome extends string> {
  outcome: TOutcome;
  receipt: DecisionPolicyReceipt<TOutcome>;
}

export function defineDecisionPolicy<
  const TQuestions extends DecisionQuestions,
  const TOutcome extends string,
>(
  definition: DecisionPolicyDefinition<TQuestions, TOutcome>,
): DecisionPolicyDefinition<TQuestions, TOutcome> {
  return definition;
}

function policyIdentity<TQuestions extends DecisionQuestions, TOutcome extends string>(
  policy: DecisionPolicyDefinition<TQuestions, TOutcome>,
) {
  return { key: policy.key, version: policy.version };
}

function validRecommendation<TOutcome extends string>(
  recommendation: DecisionPolicyRecommendation<TOutcome>,
): boolean {
  return (
    recommendation.outcome.length > 0 &&
    Number.isFinite(recommendation.confidence) &&
    recommendation.confidence >= 0 &&
    recommendation.confidence <= 1 &&
    recommendation.reason.length > 0 &&
    Object.values(recommendation.metrics ?? {}).every(Number.isFinite)
  );
}

function unavailableResult<TQuestions extends DecisionQuestions, TOutcome extends string>(
  request: EvaluateDecisionPolicyRequest<TQuestions, TOutcome>,
): DecisionPolicyResult<TOutcome> {
  return {
    outcome: request.fallback,
    receipt: {
      policy: policyIdentity(request.policy),
      status: "unavailable",
      applied: false,
      failure: "decision_unavailable",
    },
  };
}

function failedResult<TQuestions extends DecisionQuestions, TOutcome extends string>(
  request: EvaluateDecisionPolicyRequest<TQuestions, TOutcome>,
): DecisionPolicyResult<TOutcome> {
  return {
    outcome: request.fallback,
    receipt: {
      policy: policyIdentity(request.policy),
      status: "failed",
      applied: false,
      failure: "decision_failed",
    },
  };
}

function evaluatedResult<TQuestions extends DecisionQuestions, TOutcome extends string>(
  request: EvaluateDecisionPolicyRequest<TQuestions, TOutcome>,
  decision: DecideResult<TQuestions>,
): DecisionPolicyResult<TOutcome> {
  const recommendation = request.policy.evaluate(decision.answers);

  if (!validRecommendation(recommendation)) {
    return failedResult(request);
  }

  return {
    outcome: recommendation.outcome,
    receipt: {
      policy: policyIdentity(request.policy),
      status: "evaluated",
      recommendation,
      applied: true,
      provider: decision.provider,
      model: decision.model,
      usage: decision.usage,
    },
  };
}

export function createDecisionPolicyFunctions(decisions: Pick<DecisionFunctions, "tryDecide">) {
  return {
    evaluateDecisionPolicy: async <TQuestions extends DecisionQuestions, TOutcome extends string>(
      request: EvaluateDecisionPolicyRequest<TQuestions, TOutcome>,
    ): Promise<DecisionPolicyResult<TOutcome>> => {
      let decision: DecideResult<TQuestions> | null;

      try {
        const decisionRequest: DecideRequest<TQuestions> = {
          env: request.env,
          user: request.user,
          completion_id: request.completion_id,
          conversationId: request.conversationId,
          model: request.model,
          provider: request.provider,
          state: request.state,
          questions: request.policy.questions,
        };

        decision = await decisions.tryDecide(decisionRequest);
      } catch {
        return failedResult(request);
      }

      if (!decision) {
        return unavailableResult(request);
      }

      try {
        return evaluatedResult(request, decision);
      } catch {
        return failedResult(request);
      }
    },
  };
}

export type DecisionPolicyFunctions = ReturnType<typeof createDecisionPolicyFunctions>;
