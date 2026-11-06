import { estimateRunCreditMicros, isByokTurn } from "@ngriffin_uk/polychat-ai-billing";
import { estimateMessagesTokens } from "@ngriffin_uk/polychat-ai-providers";
import {
  creditsFromCreditMicros,
  isAgentExecutionMode,
  isStoredItem,
  type ResponseCostEstimate,
  type ResponseCostEstimateRequest,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { toApiMessages } from "~/modules/conversations/application/present";
import { resolveExecutableModelForRequest } from "~/modules/models/application/access";
import { resolveModeMaxSteps } from "~/modules/tools/application/permissions";
import { createUsageStore } from "~/modules/usage/application/runtime";
import {
  resolveWorkspaceFunding,
  withWorkspaceFunding,
} from "~/modules/usage/application/workspace-funding";
import type { Message } from "~/types";

function requestMessages(request: ResponseCostEstimateRequest): Message[] {
  const messages: Message[] =
    typeof request.input === "string"
      ? [{ role: "user", content: request.input }]
      : toApiMessages(request.input.filter(isStoredItem));

  return request.instructions
    ? [{ role: "system", content: request.instructions }, ...messages]
    : messages;
}

export async function estimateResponseCost(
  context: ServiceContext,
  request: ResponseCostEstimateRequest,
): Promise<ResponseCostEstimate> {
  const fundingWorkspaceId =
    context.user?.id && request.project_id
      ? await resolveWorkspaceFunding(context.repositories, {
          userId: context.user.id,
          projectId: request.project_id,
        })
      : null;

  return withWorkspaceFunding(fundingWorkspaceId, () => estimateScopedCost(context, request));
}

async function estimateScopedCost(
  context: ServiceContext,
  request: ResponseCostEstimateRequest,
): Promise<ResponseCostEstimate> {
  const { config: modelConfig } = await resolveExecutableModelForRequest({
    env: context.env,
    user: context.user,
    model: request.model,
    provider: request.provider,
  });
  const maxSteps = resolveModeMaxSteps(request.mode, request.budget?.steps);
  const estimate = estimateRunCreditMicros({
    promptTokens: estimateMessagesTokens(requestMessages(request)) + (request.history_tokens ?? 0),
    modelConfig,
    maxSteps,
    multiStep: request.mode !== undefined && isAgentExecutionMode(request.mode),
  });
  const byok =
    typeof context.user?.id === "number" &&
    (await isByokTurn(
      createUsageStore(context.repositories),
      context.user.id,
      modelConfig.provider,
    ));
  const credits = (creditMicros: number) => (byok ? 0 : creditsFromCreditMicros(creditMicros));

  return {
    model: request.model,
    basis: byok ? "byok" : estimate.stepCreditMicros > 0 ? "rates" : "unpriced",
    step_credits: credits(estimate.stepCreditMicros),
    likely_credits: credits(estimate.likelyCreditMicros),
    ceiling_credits: credits(estimate.ceilingCreditMicros),
    likely_steps: estimate.likelySteps,
    max_steps: maxSteps,
  };
}
