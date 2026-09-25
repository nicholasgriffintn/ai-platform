export const GPAI_FALLBACK_BASE_COMPUTE_FLOPS = 1e23;

export interface ModificationComputeAssessment {
  modificationFlops: number;
  thresholdFlops: number;
  ratio: number;
  exceedsThreshold: boolean;
  basis: "reported" | "fallback";
}

export function estimateTrainingFlops(parameterCount: number, tokens: number): number {
  return 6 * parameterCount * tokens;
}

export function assessModificationCompute({
  modificationFlops,
  baseTrainingFlops,
}: {
  modificationFlops: number;
  baseTrainingFlops: number | null;
}): ModificationComputeAssessment {
  const reported = baseTrainingFlops !== null && baseTrainingFlops > 0 ? baseTrainingFlops : null;
  const thresholdFlops = (reported ?? GPAI_FALLBACK_BASE_COMPUTE_FLOPS) / 3;

  return {
    modificationFlops,
    thresholdFlops,
    ratio: modificationFlops / thresholdFlops,
    exceedsThreshold: modificationFlops > thresholdFlops,
    basis: reported === null ? "fallback" : "reported",
  };
}
