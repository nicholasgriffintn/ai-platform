export type AttributeValue = string | number | boolean | null | undefined;

export type EvaluationContext = {
  targetingKey?: string;
} & Record<string, AttributeValue>;

export type JsonObject = Record<string, unknown>;

export type FlagValue = boolean | string | number | JsonObject;

export type ResolutionReason =
  | "STATIC"
  | "DEFAULT"
  | "TARGETING_MATCH"
  | "SPLIT"
  | "DISABLED"
  | "CACHED"
  | "UNKNOWN"
  | "ERROR";

export type ResolutionErrorCode =
  | "FLAG_NOT_FOUND"
  | "TYPE_MISMATCH"
  | "TARGETING_KEY_MISSING"
  | "PROVIDER_NOT_READY"
  | "PARSE_ERROR"
  | "INVALID_CONTEXT"
  | "GENERAL";

export interface ResolutionDetails<T extends FlagValue = FlagValue> {
  flagKey: string;
  value: T;
  variant?: string;
  reason: ResolutionReason;
  errorCode?: ResolutionErrorCode;
  errorMessage?: string;
  provider: string;
}

export interface FlagProvider {
  readonly name: string;
  resolve<T extends FlagValue>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<T>>;
}

export function isResolved(details: Pick<ResolutionDetails, "reason" | "errorCode">): boolean {
  return (
    details.errorCode === undefined &&
    details.reason !== "DEFAULT" &&
    details.reason !== "ERROR" &&
    details.reason !== "UNKNOWN"
  );
}
