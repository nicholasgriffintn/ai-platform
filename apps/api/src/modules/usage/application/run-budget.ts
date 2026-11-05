import {
  estimateTurnCreditMicros,
  proposeRaisedRunCap,
  resolveSpendState,
  runStepFitsCap,
  type UsageEmissionDelivery,
  type UsageStore,
} from "@ngriffin_uk/polychat-ai-billing";
import { estimateMessagesTokens, type MessageTokenInput } from "@ngriffin_uk/polychat-ai-providers";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  creditsFromCreditMicros,
  type ModelConfigItem,
  type RunMeter,
} from "@ngriffin_uk/polychat-schemas";
import { formatCredits, isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { Message } from "~/types";

const logger = getLogger({ prefix: "services/usage/run-budget" });

export const RUN_CAP_STOP_OPTION = "Stop here";

const RUN_CAP_STOPPED_NOTICE = "This run stopped at its credit cap, as you chose.";
const DELEGATE_CAP_STOPPED_NOTICE =
  "This delegate stopped at the credit budget it was given. Its work so far is above.";

export const RUN_CAP_TOOL_SKIPPED_NOTICE =
  "This tool did not run because it could take the run over its credit cap. Run it again if the cap is raised.";

export interface RunCapPause {
  message: string;
  options: string[];
  raiseOption: string;
  proposedCapCreditMicros: number;
}

export type RunStepDecision =
  | { kind: "proceed" }
  | { kind: "stopped"; notice: string }
  | { kind: "pause"; pause: RunCapPause };

export type RunCapDecision = { kind: "raise"; capCreditMicros: number } | { kind: "stop" };

export interface RunBudgetParams {
  runId: string;
  capCreditMicros: number | null;
  store: Pick<UsageStore, "getRunChargeState">;
  raiseCap: (capCreditMicros: number) => Promise<boolean>;
  modelConfig?: ModelConfigItem | null;
  modelCostIsCharged: boolean;
  stepFloorCreditMicros?: number;
  systemPrompt?: string;
  liveMeter: boolean;
  onCapReached?: "pause" | "stop";
  estimateToolCost?: (call: RunToolCall) => Promise<number | null>;
}

export interface RunToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

function credits(creditMicros: number): string {
  return formatCredits(creditsFromCreditMicros(creditMicros));
}

export function readRunCapDecision(toolResults: readonly Message[]): RunCapDecision | null {
  for (const result of toolResults) {
    const data = result.data;

    if (!isRecord(data) || !isRecord(data.runCap) || !isRecord(data.approvalResolution)) {
      continue;
    }

    const { raiseOption, proposedCapCreditMicros } = data.runCap;

    return data.approvalResolution.option === raiseOption &&
      typeof proposedCapCreditMicros === "number"
      ? { kind: "raise", capCreditMicros: proposedCapCreditMicros }
      : { kind: "stop" };
  }

  return null;
}

export class RunBudget {
  private stopped = false;

  constructor(private readonly params: RunBudgetParams) {}

  get usageDelivery(): UsageEmissionDelivery | undefined {
    return this.params.capCreditMicros !== null || this.params.liveMeter ? "inline" : undefined;
  }

  private estimateStep(messages: readonly MessageTokenInput[]): number {
    const floor = this.params.stepFloorCreditMicros ?? 0;

    if (!this.params.modelCostIsCharged) {
      return floor;
    }

    return (
      floor +
      estimateTurnCreditMicros({
        promptTokens: estimateMessagesTokens([
          { role: "system", content: this.params.systemPrompt ?? "" },
          ...messages,
        ]),
        modelConfig: this.params.modelConfig,
      })
    );
  }

  private async readCharge() {
    const state = await this.params.store.getRunChargeState(this.params.runId);

    return {
      chargedCreditMicros: (state?.chargedCreditMicros ?? 0) + (state?.delegatedCreditMicros ?? 0),
      capCreditMicros: state?.capCreditMicros ?? this.params.capCreditMicros,
    };
  }

  async assertStartable(messages: readonly MessageTokenInput[]): Promise<void> {
    const capCreditMicros = this.params.capCreditMicros;
    const stepEstimateCreditMicros = this.estimateStep(messages);

    if (
      capCreditMicros !== null &&
      !runStepFitsCap({ chargedCreditMicros: 0, capCreditMicros, stepEstimateCreditMicros })
    ) {
      throw new AssistantError(
        `A cap of ${credits(capCreditMicros)} credits is too low to start. One step of this run could use up to ${credits(stepEstimateCreditMicros)} credits.`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  }

  async applyDecision(decision: RunCapDecision | null): Promise<void> {
    if (decision?.kind === "stop") {
      this.stopped = true;
    }

    if (decision?.kind === "raise" && !(await this.params.raiseCap(decision.capCreditMicros))) {
      throw new AssistantError(
        "The run changed before its cap could be raised",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }
  }

  private async decide(stepEstimateCreditMicros: number): Promise<RunStepDecision> {
    const charge = await this.readCharge();
    const step = { ...charge, stepEstimateCreditMicros };

    if (runStepFitsCap(step)) {
      return { kind: "proceed" };
    }

    if (this.params.onCapReached === "stop") {
      return { kind: "stopped", notice: DELEGATE_CAP_STOPPED_NOTICE };
    }

    const proposedCapCreditMicros = proposeRaisedRunCap(step);
    const raiseOption = `Raise cap to ${credits(proposedCapCreditMicros)} credits`;

    return {
      kind: "pause",
      pause: {
        message: `This run has used ${credits(step.chargedCreditMicros)} of its ${credits(step.capCreditMicros ?? 0)} credit cap, and the next step could go over it. Raise the cap to keep going, or stop here.`,
        options: [raiseOption, RUN_CAP_STOP_OPTION],
        raiseOption,
        proposedCapCreditMicros,
      },
    };
  }

  async beforeStep(messages: readonly MessageTokenInput[]): Promise<RunStepDecision> {
    if (this.stopped) {
      return { kind: "stopped", notice: RUN_CAP_STOPPED_NOTICE };
    }

    if (this.params.capCreditMicros === null) {
      return { kind: "proceed" };
    }

    return this.decide(this.estimateStep(messages));
  }

  async beforeTools(calls: readonly RunToolCall[]): Promise<RunStepDecision> {
    const estimateToolCost = this.params.estimateToolCost;

    if (this.params.capCreditMicros === null || !estimateToolCost) {
      return { kind: "proceed" };
    }

    const costs = await Promise.all(calls.map((call) => estimateToolCost(call)));
    const known = costs.reduce<number>((total, cost) => total + (cost ?? 0), 0);

    return known > 0 ? this.decide(known) : { kind: "proceed" };
  }

  async readMeter(): Promise<RunMeter | null> {
    if (!this.usageDelivery) {
      return null;
    }

    try {
      const { chargedCreditMicros, capCreditMicros } = await this.readCharge();

      return {
        runId: this.params.runId,
        chargedCreditMicros: Math.max(0, chargedCreditMicros),
        capCreditMicros,
        state: resolveSpendState(chargedCreditMicros, capCreditMicros),
      };
    } catch (error) {
      logger.warn("Failed to read the run meter", { error, runId: this.params.runId });

      return null;
    }
  }
}
