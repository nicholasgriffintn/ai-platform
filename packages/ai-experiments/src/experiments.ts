import type { TelemetryEvent } from "@ngriffin_uk/polychat-ai-telemetry";
import type {
  EvaluationContext,
  FlagProvider,
  FlagValue,
  ResolutionDetails,
  ResolutionReason,
} from "@ngriffin_uk/polychat-library-flags";

import type { ExperimentDefinition, FlagDefinition, VariantName } from "./define.js";

export const EXPOSURE_EVENT_NAME = "feature_flag.evaluation";
export const EXPERIMENT_EVENT_CATEGORY = "experiment";
export const ASSIGNMENT_PROPERTY_PREFIX = "experiment.";

export type TrackingValue = string | number | boolean | null | undefined;

export interface Assignment<TConfig = unknown, TVariant extends string = string> {
  key: string;
  variant: TVariant;
  config: TConfig;
  reason: ResolutionReason;
  provider: string;
  exposed: boolean;
}

export interface TrackingDetails {
  value?: number;
  label?: string;
  properties?: Record<string, TrackingValue>;
}

export interface ExperimentsTelemetry {
  capture(event: TelemetryEvent): void;
}

export type ExperimentAssignment<TVariants extends Record<string, unknown>> = Assignment<
  TVariants[VariantName<TVariants>],
  VariantName<TVariants>
>;

export interface ExperimentsOptions {
  provider: FlagProvider;
  context: EvaluationContext;
  telemetry?: ExperimentsTelemetry;
  distinctId?: string;
  onAssign?: (assignment: Assignment) => void;
}

export interface Experiments {
  readonly context: EvaluationContext;
  assign<TVariants extends Record<string, unknown>>(
    experiment: ExperimentDefinition<TVariants>,
  ): Promise<ExperimentAssignment<TVariants>>;
  run<TVariants extends Record<string, unknown>, TResult>(
    experiment: ExperimentDefinition<TVariants>,
    execute: (
      config: TVariants[VariantName<TVariants>],
      assignment: ExperimentAssignment<TVariants>,
    ) => Promise<TResult>,
  ): Promise<TResult>;
  flag<T extends FlagValue>(flag: FlagDefinition<T>): Promise<T>;
  flagDetails<T extends FlagValue>(flag: FlagDefinition<T>): Promise<ResolutionDetails<T>>;
  track(name: string, details?: TrackingDetails): void;
  assignments(): Readonly<Record<string, string>>;
}

function isVariantName<TVariants extends Record<string, unknown>>(
  experiment: ExperimentDefinition<TVariants>,
  value: string,
): value is VariantName<TVariants> {
  return Object.hasOwn(experiment.variants, value);
}

export function assignmentProperties(
  assignments: Readonly<Record<string, string>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(assignments).map(([key, variant]) => [
      `${ASSIGNMENT_PROPERTY_PREFIX}${key}`,
      variant,
    ]),
  );
}

export function createExperiments(options: ExperimentsOptions): Experiments {
  const { provider, context, telemetry } = options;
  const distinctId = options.distinctId ?? context.targetingKey ?? "anonymous:server";
  const assigned: Record<string, string> = {};
  const exposures = new Set<string>();

  const expose = (details: ResolutionDetails, kind: "flag" | "experiment"): boolean => {
    const signature = `${details.flagKey}:${details.variant ?? ""}`;

    if (!telemetry || exposures.has(signature)) {
      return false;
    }

    exposures.add(signature);
    telemetry.capture({
      name: EXPOSURE_EVENT_NAME,
      category: EXPERIMENT_EVENT_CATEGORY,
      label: details.flagKey,
      distinctId,
      nonInteraction: true,
      properties: {
        "feature_flag.key": details.flagKey,
        "feature_flag.set.id": kind,
        "feature_flag.provider.name": details.provider,
        "feature_flag.result.variant": details.variant ?? null,
        "feature_flag.result.reason": details.reason,
        "feature_flag.context.id": context.targetingKey ?? null,
        ...(details.errorCode ? { "error.type": details.errorCode } : {}),
      },
    });

    return true;
  };

  const assign: Experiments["assign"] = async (experiment) => {
    const details = await provider.resolve(experiment.key, experiment.control, context);
    const variant = isVariantName(experiment, details.value) ? details.value : experiment.control;
    const assignment = {
      key: experiment.key,
      variant,
      config: experiment.variants[variant],
      reason: details.reason,
      provider: details.provider,
      exposed: expose({ ...details, variant }, "experiment"),
    };

    assigned[experiment.key] = variant;
    options.onAssign?.(assignment);

    return assignment;
  };

  const flagDetails: Experiments["flagDetails"] = async (flag) => {
    const details = await provider.resolve(flag.key, flag.defaultValue, context);

    expose(details, "flag");

    return details;
  };

  return {
    context,
    assign,
    run: async (experiment, execute) => {
      const assignment = await assign(experiment);

      return execute(assignment.config, assignment);
    },
    flag: async (flag) => (await flagDetails(flag)).value,
    flagDetails,
    track: (name, details = {}) => {
      telemetry?.capture({
        name,
        category: EXPERIMENT_EVENT_CATEGORY,
        label: details.label,
        value: details.value,
        distinctId,
        properties: { ...details.properties, ...assignmentProperties(assigned) },
      });
    },
    assignments: () => ({ ...assigned }),
  };
}
