import type { NormalisedTokenUsage } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  hostedToolRateEntries,
  modelRateResource,
  rateEntriesFromModelConfig,
  type ModelConfigItem,
  type RateEntry,
} from "@ngriffin_uk/polychat-schemas";

import { extractProviderBillableUsage } from "../provider-billable-units.js";
import { priceUsageDraft } from "../usage-pricing.js";

const USD_MICROS_PER_USD = 1_000_000;

export interface ModelTurnCostSignals {
  usage: NormalisedTokenUsage | null;
  rawUsage?: unknown;
  occurredAt?: string;
}

export function priceModelTurnUsage(
  modelConfig: ModelConfigItem,
  signals: ModelTurnCostSignals,
): number | null {
  const resource = modelRateResource(modelConfig);
  const rates: RateEntry[] = [
    ...rateEntriesFromModelConfig(modelConfig, { resource }),
    ...hostedToolRateEntries(modelConfig),
  ];
  const extraction = extractProviderBillableUsage(
    modelConfig.provider,
    { usage: signals.usage, raw: signals.rawUsage ?? signals.usage },
    {
      hasRate: (unit) => rates.some((rate) => rate.unit === unit),
      longContextThresholdTokens: modelConfig.longContextPricing?.inputTokenThreshold,
    },
  );

  if (extraction.units.length === 0) {
    return null;
  }

  let costMicros = 0;
  let priced = false;

  for (const unit of extraction.units) {
    const draft = priceUsageDraft({
      source: unit.source,
      vendor: modelConfig.provider,
      resource: unit.resource ?? resource,
      unit: unit.unit,
      quantity: unit.quantity,
      occurredAt: signals.occurredAt,
      rates,
      ...(extraction.tier ? { tier: extraction.tier } : {}),
    });

    if (!draft.estimated) {
      costMicros += draft.costMicros;
      priced = true;
    }
  }

  return priced ? costMicros / USD_MICROS_PER_USD : null;
}
