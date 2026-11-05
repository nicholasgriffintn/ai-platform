import {
  estimateContainerRunCreditMicros,
  priceUsageDraft,
} from "@ngriffin_uk/polychat-ai-billing";
import {
  modelRateResource,
  rateEntriesFromModelConfig,
  SANDBOX_TIMEOUT_MAX_SECONDS,
  SANDBOX_WORKSPACE_INSTANCE_TYPE,
  type ModelConfigItem,
  type UsageUnit,
} from "@ngriffin_uk/polychat-schemas";

import type { RunToolCall } from "./run-budget";

interface ModelPricedTool {
  unit: UsageUnit;
  quantity: (args: Record<string, unknown>) => number | null;
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

const MODEL_PRICED_TOOLS: Readonly<Record<string, ModelPricedTool>> = {
  create_image: { unit: "images", quantity: () => 1 },
  create_music: { unit: "audio_seconds", quantity: (args) => positiveNumber(args.duration) },
};

export function priceModelToolCall(
  modelConfig: ModelConfigItem,
  unit: UsageUnit,
  quantity: number,
): number | null {
  const resource = modelRateResource(modelConfig);
  const priced = priceUsageDraft({
    source: "capability",
    vendor: modelConfig.provider,
    resource,
    unit,
    quantity,
    rates: rateEntriesFromModelConfig(modelConfig, { resource }),
  });

  return priced.estimated ? null : priced.creditMicros;
}

export function createToolCostEstimator(params: {
  resolveModelConfig: (
    model: string,
    provider?: string,
  ) => Promise<ModelConfigItem | undefined> | undefined;
  sandboxTimeoutSeconds: number;
}) {
  return async (call: RunToolCall): Promise<number | null> => {
    if (call.name === "run_sandbox_task") {
      const requested = positiveNumber(call.arguments.timeoutSeconds);

      return estimateContainerRunCreditMicros(
        SANDBOX_WORKSPACE_INSTANCE_TYPE,
        Math.min(requested ?? params.sandboxTimeoutSeconds, SANDBOX_TIMEOUT_MAX_SECONDS),
      );
    }

    const tool = MODEL_PRICED_TOOLS[call.name];
    const model = call.arguments.model;

    if (!tool || typeof model !== "string") {
      return null;
    }

    const quantity = tool.quantity(call.arguments);
    const provider = call.arguments.provider;
    const modelConfig = await params.resolveModelConfig(
      model,
      typeof provider === "string" ? provider : undefined,
    );

    return quantity !== null && modelConfig
      ? priceModelToolCall(modelConfig, tool.unit, quantity)
      : null;
  };
}
