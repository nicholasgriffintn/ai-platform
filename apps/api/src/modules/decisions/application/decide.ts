import {
  decisionMediaModalities,
  pickDecisionMedia,
  type DecisionRequest,
  type DecisionResponse,
  type DeviceCredentialScope,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { ai } from "~/infrastructure/ai";
import type { IEnv, IUser } from "~/types";

export interface DecideOptions {
  env: IEnv;
  user: IUser;
  request: DecisionRequest;
  credentialScope?: DeviceCredentialScope;
  completionId?: string;
  conversationId?: string;
}

export async function decide({
  env,
  user,
  request,
  credentialScope,
  completionId,
  conversationId,
}: DecideOptions): Promise<DecisionResponse> {
  if (credentialScope === "pashi" && (request.model || request.provider)) {
    throw new AssistantError(
      "This key can only use the default decision model.",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const media = pickDecisionMedia(request);
  const target = await ai.resolveDecisionTarget({
    env,
    user,
    model: request.model,
    provider: request.provider,
    ...media,
  });

  if (!target) {
    throw new AssistantError(
      decisionMediaModalities(media).length > 0
        ? "No decision model that judges images, audio or video is available. Configure Workers AI to use Clef Omni."
        : "No decision model is available for this account. Configure Workers AI or add a TypeSafe or OpenAI API key in settings.",
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
    ...media,
  });
}
