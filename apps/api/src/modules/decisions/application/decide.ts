import type { DecisionRequest, DecisionResponse } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { ai } from "~/infrastructure/ai";
import type { IEnv, IUser } from "~/types";

export interface DecideOptions {
  env: IEnv;
  user: IUser;
  request: DecisionRequest;
  completionId?: string;
  conversationId?: string;
}

export async function decide({
  env,
  user,
  request,
  completionId,
  conversationId,
}: DecideOptions): Promise<DecisionResponse> {
  const target = await ai.resolveDecisionTarget({
    env,
    user,
    model: request.model,
    provider: request.provider,
  });

  if (!target) {
    throw new AssistantError(
      "No decision model is available for this account. Add a TypeSafe API key in settings to use Jev.",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return ai.decide({
    env,
    user,
    completion_id: completionId,
    conversationId,
    model: target.model,
    provider: target.provider,
    state: request.state,
    questions: request.questions,
  });
}
