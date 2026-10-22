import type { ExtractionRequest, ExtractionResponse } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { ai } from "~/infrastructure/ai";
import type { IEnv, IUser } from "~/types";

export interface ExtractValuesOptions {
  env: IEnv;
  user: IUser;
  request: ExtractionRequest;
  completionId?: string;
  conversationId?: string;
}

export async function extractValues({
  env,
  user,
  request,
  completionId,
  conversationId,
}: ExtractValuesOptions): Promise<ExtractionResponse> {
  const target = await ai.resolveExtractionTarget({
    env,
    user,
    model: request.model,
    provider: request.provider,
    images: request.images,
  });

  if (!target) {
    throw new AssistantError(
      "No extraction model is available for this account. Configure Workers AI to use Clairic.",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return ai.extractFields({
    env,
    user,
    completion_id: completionId,
    conversationId,
    model: target.model,
    provider: target.provider,
    state: request.state,
    fields: request.fields,
    images: request.images,
    reference_date: request.reference_date,
    options: request.options,
  });
}
