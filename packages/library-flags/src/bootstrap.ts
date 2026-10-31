import type { FlagProvider, FlagValue } from "./types.js";
import { matchesValueType } from "./value-type.js";

export const BOOTSTRAP_PROVIDER_NAME = "bootstrap";

export interface BootstrapEvaluation {
  flagKey: string;
  value: FlagValue;
  variant?: string;
  reason: string;
}

export function createBootstrapProvider(evaluations: readonly BootstrapEvaluation[]): FlagProvider {
  const byKey = new Map(evaluations.map((evaluation) => [evaluation.flagKey, evaluation]));

  return {
    name: BOOTSTRAP_PROVIDER_NAME,
    async resolve(flagKey, defaultValue) {
      const evaluation = byKey.get(flagKey);

      if (!evaluation) {
        return {
          flagKey,
          value: defaultValue,
          reason: "DEFAULT",
          errorCode: "FLAG_NOT_FOUND",
          provider: BOOTSTRAP_PROVIDER_NAME,
        };
      }

      if (!matchesValueType(evaluation.value, defaultValue)) {
        return {
          flagKey,
          value: defaultValue,
          reason: "ERROR",
          errorCode: "TYPE_MISMATCH",
          provider: BOOTSTRAP_PROVIDER_NAME,
        };
      }

      return {
        flagKey,
        value: evaluation.value,
        variant: evaluation.variant,
        reason: evaluation.reason === "ERROR" ? "ERROR" : "CACHED",
        provider: BOOTSTRAP_PROVIDER_NAME,
      };
    },
  };
}
