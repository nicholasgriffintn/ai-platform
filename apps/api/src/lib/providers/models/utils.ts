import type { ModelModalities } from "@ngriffin_uk/polychat-schemas";

import { availableModalities } from "~/constants/models";

const DEFAULT_MODALITIES: ModelModalities = {
  input: ["text"],
  output: ["text"],
};

type ModelConfigWithModalities = {
  modalities?: ModelModalities;
};

export function getModelInputModalities(
  modelConfig: ModelConfigWithModalities,
): ModelModalities["input"] {
  return modelConfig.modalities?.input ?? DEFAULT_MODALITIES.input;
}

export function getModelOutputModalities(
  modelConfig: ModelConfigWithModalities,
): ModelModalities["input"] {
  return modelConfig.modalities?.output ?? getModelInputModalities(modelConfig);
}

export function hasModelTextOutput(modelConfig: ModelConfigWithModalities): boolean {
  const inputs = getModelInputModalities(modelConfig);
  const outputs = getModelOutputModalities(modelConfig);

  return outputs.includes("text") || (!outputs.length && inputs.includes("text"));
}

export function producesNonTextPrimaryOutput(modelConfig: ModelConfigWithModalities): boolean {
  const outputs = getModelOutputModalities(modelConfig);

  return outputs.includes("audio") || (outputs.includes("image") && !outputs.includes("text"));
}

export { availableModalities };
