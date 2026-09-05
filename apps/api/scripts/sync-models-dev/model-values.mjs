import { SUPPORTED_MODALITIES, SUPPORTED_REASONING_EFFORT_LEVELS } from "./constants.mjs";
import { applyModelContractOverrides } from "./model-contract-overrides.mjs";
import { formatHumanDate, hasOwn, toPer1k } from "./value-utils.mjs";

export function getReasoningEffortLevels(remoteModel) {
  const reasoningOptions = Array.isArray(remoteModel.reasoning_options)
    ? remoteModel.reasoning_options
    : [];
  const effortLevels = [];

  for (const option of reasoningOptions) {
    if (!option || typeof option !== "object" || option.type !== "effort") {
      continue;
    }

    const values = Array.isArray(option.values) ? option.values : [];

    for (const value of values) {
      if (
        typeof value === "string" &&
        SUPPORTED_REASONING_EFFORT_LEVELS.has(value) &&
        !effortLevels.includes(value)
      ) {
        effortLevels.push(value);
      }
    }
  }

  return effortLevels;
}

export function isClaudeModel(remoteModel, modelKey) {
  const label = `${remoteModel.family ?? ""} ${remoteModel.id ?? modelKey ?? ""} ${remoteModel.name ?? ""}`;

  return /claude/i.test(label);
}

export function applyClaudeSamplingRules(values, remoteModel, modelKey) {
  const effortLevels = values.reasoningConfig?.supportedEffortLevels;

  if (!isClaudeModel(remoteModel, modelKey) || !effortLevels?.includes("xhigh")) {
    return values;
  }

  values.supportsTemperature = false;
  values.supportsTopP = false;

  if (!effortLevels.includes("max")) {
    values.reasoningConfig = {
      ...values.reasoningConfig,
      supportedEffortLevels: [...effortLevels, "max"],
    };
  }

  return values;
}

function buildReasoningConfig(remoteModel, existingReasoningConfig, isNewEntry) {
  const effortLevels = getReasoningEffortLevels(remoteModel);
  const existingConfig =
    existingReasoningConfig &&
    typeof existingReasoningConfig === "object" &&
    !Array.isArray(existingReasoningConfig)
      ? existingReasoningConfig
      : {};

  if (effortLevels.length > 0) {
    const existingDefault = existingConfig.defaultEffort;
    const defaultEffort = effortLevels.includes(existingDefault)
      ? existingDefault
      : effortLevels.includes("none")
        ? "none"
        : effortLevels[0];

    return {
      ...existingConfig,
      supportedEffortLevels: effortLevels,
      defaultEffort,
    };
  }

  if (!isNewEntry || !remoteModel.reasoning) {
    return undefined;
  }

  return {
    supportedEffortLevels: ["none", "thinking"],
    defaultEffort: "none",
  };
}

export function normalizeModalityList(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  const filtered = [];

  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    if (!SUPPORTED_MODALITIES.has(value)) {
      continue;
    }

    filtered.push(value);
  }

  return filtered;
}

export function normalizeModalities(modalities, { defaultToText } = { defaultToText: false }) {
  if (!modalities || typeof modalities !== "object") {
    if (!defaultToText) {
      return undefined;
    }

    return {
      input: ["text"],
      output: ["text"],
    };
  }

  const input = normalizeModalityList(modalities.input);
  const output = normalizeModalityList(modalities.output);

  if (input.length === 0) {
    if (!defaultToText) {
      return undefined;
    }

    return {
      input: ["text"],
      output: output.length > 0 ? output : ["text"],
    };
  }

  if (output.length === 0 && defaultToText) {
    return { input, output: ["text"] };
  }

  return output.length > 0 ? { input, output } : { input };
}

function isOpenRouterFreeModel(remoteModel, provider) {
  return (
    provider === "openrouter" &&
    typeof remoteModel.name === "string" &&
    /\(free\)/i.test(remoteModel.name)
  );
}

export function buildUpdateValues(
  remoteModel,
  {
    modelKey,
    existingMatchingModel,
    allowMatchingModelUpdate,
    isNewEntry,
    includeProvider,
    provider,
    existingReasoningConfig,
  },
) {
  const values = {};
  const remoteId = typeof remoteModel.id === "string" ? remoteModel.id : modelKey;

  if (isNewEntry && typeof remoteModel.name === "string" && remoteModel.name.length > 0) {
    values.name = remoteModel.name;
  }

  if (typeof remoteModel.description === "string" && remoteModel.description.trim()) {
    values.description = remoteModel.description.trim();
  }

  if (allowMatchingModelUpdate || isNewEntry) {
    values.matchingModel = remoteId;
  } else if (!existingMatchingModel && remoteId) {
    values.matchingModel = remoteId;
  }

  if (includeProvider && provider) {
    values.provider = provider;
  }

  if (typeof remoteModel.family === "string" && remoteModel.family.length > 0) {
    values.family = remoteModel.family;
  }

  if (typeof remoteModel.status === "string" && remoteModel.status.length > 0) {
    values.status = remoteModel.status;
  }

  if (hasOwn(remoteModel, "open_weights")) {
    values.openWeights = Boolean(remoteModel.open_weights);
  }

  if (isOpenRouterFreeModel(remoteModel, provider)) {
    values.isFree = true;
  }

  const knowledgeDate = formatHumanDate(remoteModel.knowledge);

  if (knowledgeDate) {
    values.knowledgeCutoffDate = knowledgeDate;
  }

  const releaseDate = formatHumanDate(remoteModel.release_date);

  if (releaseDate) {
    values.releaseDate = releaseDate;
  }

  const lastUpdated = formatHumanDate(remoteModel.last_updated);

  if (lastUpdated) {
    values.lastUpdated = lastUpdated;
  }

  const modalities = normalizeModalities(remoteModel.modalities, {
    defaultToText: isNewEntry,
  });

  if (modalities && isNewEntry) {
    values.modalities = modalities;
  }

  if (hasOwn(remoteModel, "attachment")) {
    values.supportsAttachments = Boolean(remoteModel.attachment);
  }

  if (hasOwn(remoteModel, "temperature")) {
    values.supportsTemperature = Boolean(remoteModel.temperature);
  }

  if (hasOwn(remoteModel, "tool_call")) {
    values.supportsToolCalls = Boolean(remoteModel.tool_call);
  }

  if (hasOwn(remoteModel, "structured_output")) {
    values.supportsResponseFormat = Boolean(remoteModel.structured_output);
  }

  if (remoteModel.limit && typeof remoteModel.limit === "object") {
    if (typeof remoteModel.limit.context === "number") {
      values.contextWindow = remoteModel.limit.context;
    }

    if (typeof remoteModel.limit.output === "number") {
      values.maxTokens = remoteModel.limit.output;
    }
  }

  if (remoteModel.cost && typeof remoteModel.cost === "object") {
    const inputCost = toPer1k(remoteModel.cost.input);

    if (inputCost !== undefined) {
      values.costPer1kInputTokens = inputCost;
    }

    const outputCost = toPer1k(remoteModel.cost.output);

    if (outputCost !== undefined) {
      values.costPer1kOutputTokens = outputCost;
    }

    const reasoningCost = toPer1k(remoteModel.cost.reasoning);

    if (reasoningCost !== undefined) {
      values.costPer1kReasoningTokens = reasoningCost;
    }
  }

  const reasoningConfig = buildReasoningConfig(remoteModel, existingReasoningConfig, isNewEntry);

  if (reasoningConfig) {
    values.reasoningConfig = reasoningConfig;
  }

  applyClaudeSamplingRules(values, remoteModel, remoteId);

  return applyModelContractOverrides(values, provider, remoteId);
}
