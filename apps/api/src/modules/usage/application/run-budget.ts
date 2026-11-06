import {
  estimateTurnCreditMicros,
  runStepFitsCap,
  type UsageEmissionDelivery,
  type UsageStore,
} from "@ngriffin_uk/polychat-ai-billing";
import { estimateMessagesTokens, type MessageTokenInput } from "@ngriffin_uk/polychat-ai-providers";
import { creditsFromCreditMicros, type ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { formatCredits, isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { Message } from "~/types";

const RUN_CAP_STOPPED_NOTICE = "This run stopped at its credit cap.";

export function runCapStoppedNotice(toolResults: readonly Message[]): string {
  const images = toolResults.flatMap((result) =>
    result.name === "create_image" && isRecord(result.data) && typeof result.data.url === "string"
      ? [`![Generated image](${result.data.url})`]
      : [],
  );

  return [RUN_CAP_STOPPED_NOTICE, ...images].join("\n\n");
}

export type RunStepDecision = { kind: "proceed" } | { kind: "stopped" };

export interface RunBudgetParams {
  runId: string;
  capCreditMicros: number | null;
  store: Pick<UsageStore, "getRunChargeState">;
  modelConfig?: ModelConfigItem | null;
  modelCostIsCharged: boolean;
  systemPrompt?: string;
}

function credits(creditMicros: number): string {
  return formatCredits(creditsFromCreditMicros(creditMicros));
}

export class RunBudget {
  constructor(private readonly params: RunBudgetParams) {}

  get usageDelivery(): UsageEmissionDelivery | undefined {
    return this.params.capCreditMicros !== null ? "inline" : undefined;
  }

  private estimateStep(messages: readonly MessageTokenInput[]): number {
    if (!this.params.modelCostIsCharged) {
      return 0;
    }

    return estimateTurnCreditMicros({
      promptTokens: estimateMessagesTokens([
        { role: "system", content: this.params.systemPrompt ?? "" },
        ...messages,
      ]),
      modelConfig: this.params.modelConfig,
    });
  }

  async assertStartable(messages: readonly MessageTokenInput[]): Promise<void> {
    const capCreditMicros = this.params.capCreditMicros;
    const stepEstimateCreditMicros = this.estimateStep(messages);

    if (
      capCreditMicros !== null &&
      !runStepFitsCap({ chargedCreditMicros: 0, capCreditMicros, stepEstimateCreditMicros })
    ) {
      throw new AssistantError(
        `A cap of ${credits(capCreditMicros)} credits is too low to start. One step of this run could use more than that.`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  }

  async beforeStep(messages: readonly MessageTokenInput[]): Promise<RunStepDecision> {
    const capCreditMicros = this.params.capCreditMicros;

    if (capCreditMicros === null) {
      return { kind: "proceed" };
    }

    const state = await this.params.store.getRunChargeState(this.params.runId);
    const fits = runStepFitsCap({
      chargedCreditMicros: state?.chargedCreditMicros ?? 0,
      capCreditMicros: state?.capCreditMicros ?? capCreditMicros,
      stepEstimateCreditMicros: this.estimateStep(messages),
    });

    return { kind: fits ? "proceed" : "stopped" };
  }
}
