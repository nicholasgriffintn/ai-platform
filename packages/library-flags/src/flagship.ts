import type {
  EvaluationContext,
  FlagProvider,
  FlagValue,
  ResolutionDetails,
  ResolutionErrorCode,
  ResolutionReason,
} from "./types.js";
import { matchesValueType } from "./value-type.js";

export type FlagshipContext = Record<string, string | number | boolean>;

export interface FlagshipDetails<T> {
  flagKey: string;
  value: T;
  variant?: string;
  reason?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface FlagshipBinding {
  get(flagKey: string, defaultValue?: unknown, context?: FlagshipContext): Promise<unknown>;
  getBooleanDetails(
    flagKey: string,
    defaultValue: boolean,
    context?: FlagshipContext,
  ): Promise<FlagshipDetails<boolean>>;
  getStringDetails(
    flagKey: string,
    defaultValue: string,
    context?: FlagshipContext,
  ): Promise<FlagshipDetails<string>>;
  getNumberDetails(
    flagKey: string,
    defaultValue: number,
    context?: FlagshipContext,
  ): Promise<FlagshipDetails<number>>;
  getObjectDetails<T extends object>(
    flagKey: string,
    defaultValue: T,
    context?: FlagshipContext,
  ): Promise<FlagshipDetails<T>>;
}

export const FLAGSHIP_PROVIDER_NAME = "flagship";

const REASONS: ReadonlySet<string> = new Set([
  "STATIC",
  "DEFAULT",
  "TARGETING_MATCH",
  "SPLIT",
  "DISABLED",
  "CACHED",
  "UNKNOWN",
  "ERROR",
]);
const ERROR_CODES: ReadonlySet<string> = new Set([
  "FLAG_NOT_FOUND",
  "TYPE_MISMATCH",
  "TARGETING_KEY_MISSING",
  "PROVIDER_NOT_READY",
  "PARSE_ERROR",
  "INVALID_CONTEXT",
  "GENERAL",
]);

export function toFlagshipContext(context: EvaluationContext): FlagshipContext {
  const flagship: FlagshipContext = {};

  for (const [key, value] of Object.entries(context)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      flagship[key] = value;
    }
  }

  return flagship;
}

function readReason(reason: string | undefined): ResolutionReason {
  return reason && REASONS.has(reason) ? (reason as ResolutionReason) : "UNKNOWN";
}

function readErrorCode(code: string | undefined): ResolutionErrorCode | undefined {
  if (!code) {
    return undefined;
  }

  return ERROR_CODES.has(code) ? (code as ResolutionErrorCode) : "GENERAL";
}

async function evaluate<T extends FlagValue>(
  binding: FlagshipBinding,
  flagKey: string,
  defaultValue: T,
  context: FlagshipContext,
): Promise<FlagshipDetails<unknown>> {
  switch (typeof defaultValue) {
    case "boolean":
      return binding.getBooleanDetails(flagKey, defaultValue, context);
    case "string":
      return binding.getStringDetails(flagKey, defaultValue, context);
    case "number":
      return binding.getNumberDetails(flagKey, defaultValue, context);
    default:
      return binding.getObjectDetails(flagKey, defaultValue, context);
  }
}

export function createFlagshipProvider(binding: FlagshipBinding): FlagProvider {
  return {
    name: FLAGSHIP_PROVIDER_NAME,
    async resolve(flagKey, defaultValue, context) {
      const fallback: ResolutionDetails<typeof defaultValue> = {
        flagKey,
        value: defaultValue,
        reason: "ERROR",
        errorCode: "GENERAL",
        provider: FLAGSHIP_PROVIDER_NAME,
      };

      let details: FlagshipDetails<unknown>;

      try {
        details = await evaluate(binding, flagKey, defaultValue, toFlagshipContext(context));
      } catch (error) {
        return {
          ...fallback,
          errorMessage: error instanceof Error ? error.message : String(error),
        };
      }

      const errorCode = readErrorCode(details.errorCode);

      if (errorCode) {
        return {
          ...fallback,
          reason: readReason(details.reason) === "UNKNOWN" ? "ERROR" : readReason(details.reason),
          errorCode,
          errorMessage: details.errorMessage,
        };
      }

      if (!matchesValueType(details.value, defaultValue)) {
        return { ...fallback, errorCode: "TYPE_MISMATCH" };
      }

      return {
        flagKey,
        value: details.value,
        variant: details.variant,
        reason: readReason(details.reason),
        provider: FLAGSHIP_PROVIDER_NAME,
      };
    },
  };
}
