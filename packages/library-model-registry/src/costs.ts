import type {
  Adaptation,
  CostEstimate,
  HardwareOption,
  TrainerManifest,
  TrainingMethod,
} from "@ngriffin_uk/polychat-schemas";

const PEAK_BF16_TFLOPS: Record<string, number> = {
  "nvidia-t4": 65,
  "nvidia-l4": 121,
  "nvidia-a10g": 125,
  "nvidia-rtx-4090": 165,
  "nvidia-a100": 312,
  "nvidia-l40s": 362,
  "nvidia-rtx-pro-6000": 500,
  "nvidia-h100": 989,
  "nvidia-h200": 989,
  "nvidia-b200": 2250,
  "amd-mi300x": 1307,
};

const MODEL_FLOPS_UTILISATION = 0.35;
const LOW_FACTOR = 0.6;
const HIGH_FACTOR = 1.8;
const HOURS_PER_MONTH = 730;

interface TokenPriceTier {
  maxParameters: number;
  lora: number;
  full: number;
}

const TOKEN_PRICES: Record<string, TokenPriceTier[]> = {
  "together-fine-tuning": [
    { maxParameters: 16e9, lora: 0.48, full: 0.54 },
    { maxParameters: 69e9, lora: 1.5, full: 1.65 },
    { maxParameters: 100e9, lora: 2.9, full: 3.2 },
    { maxParameters: Number.POSITIVE_INFINITY, lora: 6, full: 10 },
  ],
  "fireworks-fine-tuning": [
    { maxParameters: 16e9, lora: 0.5, full: 0.5 },
    { maxParameters: 80e9, lora: 3, full: 3 },
    { maxParameters: Number.POSITIVE_INFINITY, lora: 10, full: 10 },
  ],
  "nebius-fine-tuning": [
    { maxParameters: 20e9, lora: 0.4, full: 0.8 },
    { maxParameters: 80e9, lora: 1.2, full: 2.4 },
    { maxParameters: Number.POSITIVE_INFINITY, lora: 4, full: 8 },
  ],
  "bedrock-customisation": [
    { maxParameters: 16e9, lora: 0.8, full: 0.8 },
    { maxParameters: Number.POSITIVE_INFINITY, lora: 4, full: 4 },
  ],
};

export function trainingTokens({
  method,
  datasetTokens,
  epochs,
  generationsPerPrompt,
}: {
  method: TrainingMethod;
  datasetTokens: number;
  epochs: number;
  generationsPerPrompt: number;
}): number {
  if (method === "merge" || method === "quantise") {
    return 0;
  }

  const perEpoch = method === "rft" ? datasetTokens * generationsPerPrompt * 2 : datasetTokens;

  return Math.round(perEpoch * epochs);
}

function flopsPerToken(
  parameterCount: number,
  adaptation: Adaptation,
  method: TrainingMethod,
): number {
  if (method === "merge" || method === "quantise") {
    return 0;
  }

  return (adaptation === "full" ? 6 : 4) * parameterCount;
}

export function estimateGpuHours({
  parameterCount,
  tokens,
  adaptation,
  method,
  hardware,
}: {
  parameterCount: number;
  tokens: number;
  adaptation: Adaptation;
  method: TrainingMethod;
  hardware: HardwareOption;
}): number | null {
  const peak = PEAK_BF16_TFLOPS[hardware.accelerator];

  if (peak === undefined || hardware.count === 0) {
    return null;
  }

  if (method === "merge" || method === "quantise") {
    return 0.5;
  }

  const seconds =
    (flopsPerToken(parameterCount, adaptation, method) * tokens) /
    (peak * 1e12 * MODEL_FLOPS_UTILISATION * hardware.count);

  return Math.max(0.1, seconds / 3600 + 0.25);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function estimateTrainingCost({
  trainer,
  hardware,
  parameterCount,
  tokens,
  adaptation,
  method,
}: {
  trainer: TrainerManifest;
  hardware: HardwareOption | null;
  parameterCount: number | null;
  tokens: number;
  adaptation: Adaptation;
  method: TrainingMethod;
}): CostEstimate {
  if (parameterCount === null) {
    return {
      usd: null,
      low: null,
      high: null,
      basis: "Unknown parameter count",
      gpuHours: null,
      tokens,
    };
  }

  if (trainer.pricing.unit === "million_tokens") {
    const tier = (TOKEN_PRICES[trainer.id] ?? []).find(
      (item) => parameterCount <= item.maxParameters,
    );

    if (!tier) {
      return {
        usd: null,
        low: null,
        high: null,
        basis: trainer.pricing.note,
        gpuHours: null,
        tokens,
      };
    }

    const usd = (tokens / 1e6) * (adaptation === "full" ? tier.full : tier.lora);

    return {
      usd: round(usd),
      low: round(usd),
      high: round(usd * 1.1),
      basis: "Approximate list price per training token",
      gpuHours: null,
      tokens,
    };
  }

  if (!hardware || hardware.hourlyUsd === null) {
    return {
      usd: null,
      low: null,
      high: null,
      basis: "Pick hardware to estimate",
      gpuHours: null,
      tokens,
    };
  }

  const hours = estimateGpuHours({ parameterCount, tokens, adaptation, method, hardware });

  if (hours === null) {
    return {
      usd: null,
      low: null,
      high: null,
      basis: "Unknown accelerator throughput",
      gpuHours: null,
      tokens,
    };
  }

  const usd = hours * hardware.hourlyUsd;

  return {
    usd: round(usd),
    low: round(usd * LOW_FACTOR),
    high: round(usd * HIGH_FACTOR),
    basis: `About ${round(hours)} hours on ${hardware.label} at 35% utilisation`,
    gpuHours: round(hours * hardware.count),
    tokens,
  };
}

export function estimateMonthlyHostingCost({
  hourlyUsd,
  minReplicas,
  scaleToZero,
}: {
  hourlyUsd: number | null;
  minReplicas: number;
  scaleToZero: boolean;
}): number | null {
  if (hourlyUsd === null) {
    return null;
  }

  return round(hourlyUsd * Math.max(scaleToZero ? 0 : 1, minReplicas) * HOURS_PER_MONTH);
}
