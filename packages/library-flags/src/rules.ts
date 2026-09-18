import { bucketFor, pickWeighted } from "./bucketing.js";
import type {
  EvaluationContext,
  FlagProvider,
  FlagValue,
  ResolutionDetails,
  ResolutionReason,
} from "./types.js";
import { matchesValueType } from "./value-type.js";

export interface FlagRule<T extends FlagValue = FlagValue> {
  key: string;
  variants: Record<string, T>;
  defaultVariant: string;
  split?: Record<string, number>;
  target?: (context: EvaluationContext) => string | undefined;
  enabled?: (context: EvaluationContext) => boolean;
  salt?: string;
}

export type RuleLookup = (flagKey: string) => FlagRule | undefined;

export const RULES_PROVIDER_NAME = "rules";

interface Selection {
  variant: string;
  reason: ResolutionReason;
  errorCode?: ResolutionDetails["errorCode"];
}

async function selectVariant(rule: FlagRule, context: EvaluationContext): Promise<Selection> {
  if (rule.enabled && !rule.enabled(context)) {
    return { variant: rule.defaultVariant, reason: "DISABLED" };
  }

  const targeted = rule.target?.(context);

  if (targeted !== undefined && targeted in rule.variants) {
    return { variant: targeted, reason: "TARGETING_MATCH" };
  }

  if (!rule.split) {
    return { variant: rule.defaultVariant, reason: "STATIC" };
  }

  if (!context.targetingKey) {
    return {
      variant: rule.defaultVariant,
      reason: "DEFAULT",
      errorCode: "TARGETING_KEY_MISSING",
    };
  }

  const entries = Object.entries(rule.split)
    .filter(([variant]) => variant in rule.variants)
    .map(([key, weight]) => ({ key, weight }));
  const picked = pickWeighted(
    await bucketFor(context.targetingKey, rule.salt ?? rule.key),
    entries,
  );

  return picked === undefined
    ? { variant: rule.defaultVariant, reason: "STATIC" }
    : { variant: picked, reason: "SPLIT" };
}

export function createRulesProvider(lookup: RuleLookup): FlagProvider {
  return {
    name: RULES_PROVIDER_NAME,
    async resolve(flagKey, defaultValue, context) {
      const rule = lookup(flagKey);

      if (!rule) {
        return {
          flagKey,
          value: defaultValue,
          reason: "DEFAULT",
          errorCode: "FLAG_NOT_FOUND",
          provider: RULES_PROVIDER_NAME,
        };
      }

      const selection = await selectVariant(rule, context);
      const value = rule.variants[selection.variant];

      if (value === undefined || !matchesValueType(value, defaultValue)) {
        return {
          flagKey,
          value: defaultValue,
          reason: "ERROR",
          errorCode: "TYPE_MISMATCH",
          errorMessage: `Variant "${selection.variant}" of "${flagKey}" does not match the requested type`,
          provider: RULES_PROVIDER_NAME,
        };
      }

      return {
        flagKey,
        value,
        variant: selection.variant,
        reason: selection.reason,
        ...(selection.errorCode ? { errorCode: selection.errorCode } : {}),
        provider: RULES_PROVIDER_NAME,
      };
    },
  };
}
