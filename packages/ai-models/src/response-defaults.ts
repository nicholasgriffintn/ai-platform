import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

import { isConfiguredReasoningEffort } from "./reasoning.js";
import type { ReasoningEffortLevel, VerbosityLevel } from "./types.js";
import { isConfiguredVerbosity } from "./verbosity.js";

export interface ModelResponseSettings {
  reasoning_effort?: ReasoningEffortLevel;
  verbosity?: VerbosityLevel;
}

function resolveDefaultReasoningEffort(
  params: ModelResponseSettings,
  modelConfig: ModelConfigItem | undefined,
): ReasoningEffortLevel | undefined {
  if (params.reasoning_effort !== undefined) {
    return undefined;
  }

  const defaultEffort = modelConfig?.reasoningConfig?.defaultEffort;

  return isConfiguredReasoningEffort(modelConfig, defaultEffort) ? defaultEffort : undefined;
}

function resolveDefaultVerbosity(
  params: ModelResponseSettings,
  modelConfig: ModelConfigItem | undefined,
): VerbosityLevel | undefined {
  if (params.verbosity !== undefined) {
    return undefined;
  }

  const defaultVerbosity = modelConfig?.verbosityConfig?.defaultVerbosity;

  return isConfiguredVerbosity(modelConfig, defaultVerbosity) ? defaultVerbosity : undefined;
}

export function applyModelResponseDefaults<T extends ModelResponseSettings>(
  params: T,
  modelConfig: ModelConfigItem | undefined,
): T {
  const reasoningEffort = resolveDefaultReasoningEffort(params, modelConfig);
  const verbosity = resolveDefaultVerbosity(params, modelConfig);

  if (!reasoningEffort && !verbosity) {
    return params;
  }

  return {
    ...params,
    ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
    ...(verbosity ? { verbosity } : {}),
  };
}
