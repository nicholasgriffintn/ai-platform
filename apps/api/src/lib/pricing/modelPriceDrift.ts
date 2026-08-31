import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";

import type { ArtificialAnalysisModelRecord } from "~/lib/artificial-analysis/types";
import { normaliseModelIdentifier } from "~/utils/models";

export const MODEL_PRICE_DRIFT_TOLERANCE = 0.2;

export interface ModelPriceDrift {
  modelId: string;
  provider?: string;
  matchingModel: string;
  referenceId: string;
  catalogueCostPer1kInputTokens?: number;
  referenceCostPer1kInputTokens?: number;
  inputDrift?: number;
  catalogueCostPer1kOutputTokens?: number;
  referenceCostPer1kOutputTokens?: number;
  outputDrift?: number;
}

export interface ModelPriceDriftReport {
  compared: number;
  matched: number;
  drifted: ModelPriceDrift[];
}

function relativeDrift(catalogue?: number, reference?: number): number | undefined {
  if (catalogue === undefined || reference === undefined || reference <= 0) {
    return undefined;
  }

  return Math.abs(catalogue - reference) / reference;
}

function buildReferenceIndex(
  references: readonly ArtificialAnalysisModelRecord[],
): Map<string, ArtificialAnalysisModelRecord> {
  const index = new Map<string, ArtificialAnalysisModelRecord>();

  for (const reference of references) {
    for (const key of [reference.slug, reference.name, reference.id]) {
      const normalised = key ? normaliseModelIdentifier(key) : "";

      if (normalised && !index.has(normalised)) {
        index.set(normalised, reference);
      }
    }
  }

  return index;
}

function costPer1kFromPricePerMillion(price?: number): number | undefined {
  return typeof price === "number" && Number.isFinite(price) && price > 0
    ? price / 1000
    : undefined;
}

export function detectModelPriceDrift(
  catalogue: ModelConfig,
  references: readonly ArtificialAnalysisModelRecord[],
  tolerance: number = MODEL_PRICE_DRIFT_TOLERANCE,
): ModelPriceDriftReport {
  const index = buildReferenceIndex(references);
  const drifted: ModelPriceDrift[] = [];
  let compared = 0;
  let matched = 0;

  for (const [modelId, model] of Object.entries(catalogue)) {
    if (!model.costPer1kInputTokens && !model.costPer1kOutputTokens) {
      continue;
    }

    compared += 1;

    const reference =
      index.get(normaliseModelIdentifier(model.matchingModel ?? modelId)) ??
      index.get(normaliseModelIdentifier(modelId));

    if (!reference) {
      continue;
    }

    matched += 1;

    const referenceInput = costPer1kFromPricePerMillion(reference.price_1m_input_tokens);
    const referenceOutput = costPer1kFromPricePerMillion(reference.price_1m_output_tokens);
    const inputDrift = relativeDrift(model.costPer1kInputTokens, referenceInput);
    const outputDrift = relativeDrift(model.costPer1kOutputTokens, referenceOutput);

    if (
      (inputDrift === undefined || inputDrift <= tolerance) &&
      (outputDrift === undefined || outputDrift <= tolerance)
    ) {
      continue;
    }

    drifted.push({
      modelId,
      provider: model.provider,
      matchingModel: model.matchingModel ?? modelId,
      referenceId: reference.id,
      catalogueCostPer1kInputTokens: model.costPer1kInputTokens,
      referenceCostPer1kInputTokens: referenceInput,
      inputDrift,
      catalogueCostPer1kOutputTokens: model.costPer1kOutputTokens,
      referenceCostPer1kOutputTokens: referenceOutput,
      outputDrift,
    });
  }

  return { compared, matched, drifted };
}
