import { estimateContainerRunCreditMicros, isByokTurn } from "@ngriffin_uk/polychat-ai-billing";
import {
  isAgentExecutionMode,
  SANDBOX_TIMEOUT_DEFAULT_SECONDS,
  SANDBOX_WORKSPACE_INSTANCE_TYPE,
  type ModelConfigItem,
  type RunProvenance,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { resolveExecutionRoute } from "~/modules/models/domain/execution-route";
import type { ChatRunLifecycle } from "~/modules/responses/application/runs/lifecycle";
import { RunBudget } from "~/modules/usage/application/run-budget";
import { createUsageRuntime, createUsageStore } from "~/modules/usage/application/runtime";
import { createToolCostEstimator } from "~/modules/usage/application/tool-cost";
import type { ChatMode, CoreChatOptions } from "~/types";

export async function createChatRunBudget(params: {
  chatOptions: CoreChatOptions;
  runLifecycle?: ChatRunLifecycle | null;
  runProvenance?: RunProvenance;
  modelConfig?: ModelConfigItem | null;
  provider: string;
  mode: ChatMode;
  systemPrompt?: string;
}): Promise<RunBudget | undefined> {
  const { chatOptions, runLifecycle, runProvenance } = params;
  const context = chatOptions.context;

  if (!runLifecycle || !context) {
    if (chatOptions.budget_constraint !== undefined) {
      throw new AssistantError(
        "A credit cap needs a stored conversation and a signed-in account",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    return undefined;
  }

  const { run } = runLifecycle;
  const store = createUsageStore(context.repositories);
  const hosted = runProvenance?.site === undefined || runProvenance.site === "hosted";
  const capCreditMicros = run.spendCapCreditMicros ?? null;
  const sandboxTimeoutSeconds =
    chatOptions.options?.sandbox?.timeoutSeconds ?? SANDBOX_TIMEOUT_DEFAULT_SECONDS;
  const byok =
    capCreditMicros !== null && (await isByokTurn(store, run.initiatorUserId, params.provider));

  return new RunBudget({
    runId: run.id,
    capCreditMicros,
    store,
    raiseCap: (raisedCreditMicros) =>
      context.repositories
        .get(ConversationRunRepository)
        .raiseSpendCap(run.id, run.attempt, raisedCreditMicros),
    modelConfig: params.modelConfig,
    modelCostIsCharged: hosted && !byok,
    stepFloorCreditMicros:
      capCreditMicros !== null && resolveExecutionRoute(params.modelConfig) === "sandbox"
        ? estimateContainerRunCreditMicros(SANDBOX_WORKSPACE_INSTANCE_TYPE, sandboxTimeoutSeconds)
        : 0,
    systemPrompt: params.systemPrompt,
    liveMeter: isAgentExecutionMode(params.mode),
    onCapReached: chatOptions.durable_execution?.kind === "delegation" ? "stop" : "pause",
    estimateToolCost: createToolCostEstimator({
      resolveModelConfig: (model, provider) =>
        createUsageRuntime({
          env: chatOptions.env,
          repositories: context.repositories,
        }).resolveModelConfig?.(model, provider, run.initiatorUserId),
      sandboxTimeoutSeconds,
    }),
  });
}
