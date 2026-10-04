import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { DecisionCorrection, DecisionFeedbackRequest } from "@ngriffin_uk/polychat-schemas";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { DecisionFeedbackRepository } from "~/modules/decisions/infrastructure/DecisionFeedbackRepository";
import type { IEnv, IUser } from "~/types";

const logger = getLogger({ prefix: "services/decisions/feedback" });

export const MAX_PRIOR_CORRECTIONS = 5;

export async function recordDecisionFeedback(
  context: ServiceContext,
  request: DecisionFeedbackRequest,
): Promise<{ recorded: boolean; policyKey: string; policyVersion: string }> {
  const user = context.requireUser();

  await new DecisionFeedbackRepository(context.env).record({
    policyKey: request.policyKey,
    policyVersion: request.policyVersion,
    userId: user.id,
    recommended: request.recommended,
    corrected: request.corrected,
    summary: redactSensitiveTokens(request.summary),
  });

  return {
    recorded: true,
    policyKey: request.policyKey,
    policyVersion: request.policyVersion,
  };
}

export async function loadDecisionCorrections(params: {
  env: IEnv;
  user?: IUser;
  policy: { key: string; version: string };
  limit?: number;
}): Promise<DecisionCorrection[]> {
  if (!params.user?.id || !params.env.DB) {
    return [];
  }

  try {
    return await new DecisionFeedbackRepository(params.env).recentCorrections({
      policyKey: params.policy.key,
      policyVersion: params.policy.version,
      userId: params.user.id,
      limit: params.limit ?? MAX_PRIOR_CORRECTIONS,
    });
  } catch (error) {
    logger.warn("Failed to load prior decision corrections", {
      error,
      policyKey: params.policy.key,
    });

    return [];
  }
}
