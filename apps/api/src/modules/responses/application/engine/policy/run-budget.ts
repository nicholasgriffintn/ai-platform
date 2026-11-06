import { isByokTurn } from "@ngriffin_uk/polychat-ai-billing";
import type { ModelConfigItem, RunProvenance } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ChatRunLifecycle } from "~/modules/responses/application/runs/lifecycle";
import { RunBudget } from "~/modules/usage/application/run-budget";
import { createUsageStore } from "~/modules/usage/application/runtime";
import type { CoreChatOptions } from "~/types";

export async function createChatRunBudget(params: {
  chatOptions: CoreChatOptions;
  runLifecycle?: ChatRunLifecycle | null;
  runProvenance?: RunProvenance;
  modelConfig?: ModelConfigItem | null;
  provider: string;
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
  const byok =
    capCreditMicros !== null && (await isByokTurn(store, run.initiatorUserId, params.provider));

  return new RunBudget({
    runId: run.id,
    capCreditMicros,
    store,
    modelConfig: params.modelConfig,
    modelCostIsCharged: hosted && !byok,
    systemPrompt: params.systemPrompt,
  });
}
